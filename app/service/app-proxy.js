'use strict';
var ports=require('./ports').values,appLabels=require('./app-labels');
// Package labels, not Unix UIDs: TV applications commonly share uid 5001.
function q(s){return "'"+String(s).replace(/'/g,"'\\''")+"'";}
var GROUP='/sys/fs/cgroup/net_cls/tizy-apps',DEFAULT_GROUP='/sys/fs/cgroup/net_cls/tizy-default',CLASS=21335;
function preferences(value){
    if(value===undefined)value={};
    if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Некорректная настройка прокси по приложениям');
    if(value.enabled!==undefined&&typeof value.enabled!=='boolean')throw new Error('Некорректная настройка прокси по приложениям');
    if(value.mode!==undefined&&['direct','vpn'].indexOf(value.mode)<0)throw new Error('Некорректный режим прокси по приложениям');
    function list(input){if(input===undefined)return [];if(!Array.isArray(input)||input.length>500||input.some(function(x){return typeof x!=='string'||!validId(x);}))throw new Error('Некорректный список приложений');return input.filter(function(x,i){return input.indexOf(x)===i;}).sort();}
    return {enabled:value.enabled===true,mode:value.mode||'direct',direct:list(value.direct),vpn:list(value.vpn)};
}
function validId(id){return /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,159}$/.test(id);}
function selected(value){var p=preferences(value);return p[p.mode];}
function registryCommand(){
    // HEX preserves localized names without shell/SQL delimiter ambiguities.
    var sql="SELECT hex(a.package),hex(a.app_id),hex(coalesce((SELECT app_label FROM package_app_localized_info l WHERE l.app_id=a.app_id AND l.app_locale IN ('ru_RU','ru-ru','ru') ORDER BY CASE l.app_locale WHEN 'ru_RU' THEN 0 ELSE 1 END LIMIT 1),'')),hex(coalesce((SELECT app_label FROM package_app_localized_info l WHERE l.app_id=a.app_id AND l.app_locale IN ('en_US','en-us','en','No Locale') ORDER BY CASE l.app_locale WHEN 'en_US' THEN 0 WHEN 'en-us' THEN 1 WHEN 'en' THEN 2 ELSE 3 END LIMIT 1),'')) FROM package_app_info a JOIN package_info p ON a.package=p.package WHERE a.app_component='uiapp' AND coalesce(a.app_nodisplay,'false')!='true' AND coalesce(a.app_disable,'false')!='true' AND coalesce(p.package_disable,'false')!='true' AND coalesce(p.package_nodisplay,'false')!='true' AND (p.package_system!='true' OR a.package IN ('com.samsung.tv.cobalt','com.samsung.tv.knox-browser')) ORDER BY a.package,a.app_id;";
    return 'sqlite3 -readonly /opt/dbspace/.pkgmgr_parser.db '+q(sql);
}
function parseRegistry(output){
    var byPackage=Object.create(null);
    String(output).trim().split('\n').filter(Boolean).forEach(function(row){
        var fields=row.split('|');if(fields.length!==4||fields.some(function(x){return !/^(?:[0-9A-Fa-f]{2})*$/.test(x);}))throw new Error('Не удалось прочитать список приложений');
        fields=fields.map(function(x){return Buffer.from(x,'hex').toString('utf8');});
        var id=fields[0];if(!validId(id)||['severtvapp','vetrotvapp'].indexOf(id)>=0)return;
        var item=byPackage[id]||(byPackage[id]={id:id,name:fields[3]||fields[2]||fields[1],nameRu:fields[2]||fields[3]||fields[1],appIds:[]});
        item.appIds.push(fields[1]);
        if(fields[3]&&item.name===item.appIds[0])item.name=fields[3];
    });
    return Object.keys(byPackage).map(function(id){var item=byPackage[id];if(id==='com.samsung.tv.cobalt'){item.name=item.nameRu='YouTube / YouTube Kids / YouTube TV';}item.shared=item.appIds.length>1;return appLabels.apply(item);}).sort(function(a,b){return a.name.localeCompare(b.name);});
}
function prepare(){return [GROUP,DEFAULT_GROUP].map(function(group){return 'mkdir -p '+q(group)+' && chmod 755 '+q(group)+' && echo '+(group===GROUP?CLASS:0)+' > '+q(group+'/net_cls.classid')+' && chown 5001:5001 '+q(group+'/cgroup.procs')+' && chmod 600 '+q(group+'/cgroup.procs');}).join(' && ');}
function cleanup(){
    // Only our processes, originally in the neutral root class, are restored.
    return [GROUP,DEFAULT_GROUP].map(function(group){return 'if test -d '+q(group)+'; then tizy_members=$(cat '+q(group+'/cgroup.procs')+' 2>/dev/null); for tizy_pid in $tizy_members; do case "$tizy_pid" in ""|*[!0-9]*) continue;; esac; echo "$tizy_pid" > /sys/fs/cgroup/net_cls/cgroup.procs 2>/dev/null || true; done; rmdir '+q(group)+' 2>/dev/null || true; fi';}).join('\n');
}
function Monitor(options){this.fs=options&&options.fs||require('fs');this.proc=options&&options.proc||'/proc';this.owned=Object.create(null);this.cache=Object.create(null);this.timer=null;this.error='';this.onError=options&&options.onError||function(){};}
Monitor.prototype.start=function(value){
    this.stop();var p=preferences(value);this.ids=selected(p);this.error='';if(!p.enabled||!this.ids.length)return;
    this.labels=this.ids.map(function(id){return 'User::Pkg::'+id;});
    this.scan();var self=this;this.timer=setInterval(function(){try{self.scan();}catch(e){self.error='Не удалось применить маршрутизацию к процессам приложения';self.stop();self.onError(new Error(self.error));}},100);if(this.timer.unref)this.timer.unref();
};
Monitor.prototype.stop=function(){if(this.timer)clearInterval(this.timer);this.timer=null;this.owned=Object.create(null);this.cache=Object.create(null);};
Monitor.prototype.scan=function(){
    var self=this,fs=this.fs,seen=Object.create(null),pids=Object.create(null),now=Date.now(),members=fs.readFileSync(GROUP+'/cgroup.procs','utf8').trim().split(/\s+/);
    fs.readdirSync(this.proc).filter(function(pid){return /^[1-9][0-9]*$/.test(pid);}).forEach(function(pid){
        pids[pid]=true;var record=self.cache[pid]||(self.cache[pid]={first:now,next:0}),inherited=members.indexOf(pid)>=0,previous=self.owned[pid];
        if(!inherited&&!previous&&record.next>now)return;
        var base=self.proc+'/'+pid,label,stat,identity,group;
        // Kernel/root tasks cannot be moved by the service and are not UI apps.
        // Cache stable tasks, but retry a freshly forked task while it drops uid.
        try{if(fs.statSync(base).uid!==process.getuid()){record.next=now+(now-record.first<1000?100:2000);return;}}catch(e){if(e.code==='ENOENT'||e.code==='ESRCH')return;throw e;}
        try{label=fs.readFileSync(base+'/attr/current','utf8').trim();}catch(e){if(e.code==='ENOENT'||e.code==='ESRCH')return;try{if(fs.statSync(base).uid!==process.getuid())return;}catch(ignore){return;}throw e;}
        record.next=now+(/^User::Pkg::/.test(label)?1000:now-record.first<1000||label==='User'?100:5000);
        var match=self.labels.indexOf(label)>=0;if(!match&&!previous&&!inherited)return;
        try{
            stat=fs.readFileSync(base+'/stat','utf8');identity=stat.slice(stat.lastIndexOf(')')+2).split(' ')[19];
            group=fs.readFileSync(base+'/cgroup','utf8').split('\n').filter(function(line){return /^[0-9]+:net_cls:/.test(line);})[0];group=group&&group.split(':')[2];
            if(match){
                if(['/', '/tizy-default','/tizy-apps'].indexOf(group)<0)throw new Error('Приложение использует отдельную сетевую группу');
                if(group!=='/tizy-apps')fs.writeFileSync(GROUP+'/cgroup.procs',pid);
                self.owned[pid]=identity;seen[pid]=true;
            }else if(group==='/tizy-apps'&&(previous===identity||inherited&&fs.statSync(base).uid===process.getuid())){
                fs.writeFileSync(DEFAULT_GROUP+'/cgroup.procs',pid);delete self.owned[pid];
            }else delete self.owned[pid];
        }catch(e){if(e.code==='ENOENT'||e.code==='ESRCH')return;throw e;}
    });
    Object.keys(this.owned).forEach(function(pid){if(!seen[pid])delete self.owned[pid];});
    Object.keys(this.cache).forEach(function(pid){if(!pids[pid])delete self.cache[pid];});
};
function selective(value){var p=preferences(value);return p.enabled&&selected(p).length>0;}
function policyKey(value){var p=preferences(value);return selective(p)?JSON.stringify([p.mode,selected(p)]):'global';}
function guards(prefix,value){var p=preferences(value);if(!selective(p))return [];return [prefix+' -m cgroup '+(p.mode==='vpn'?'! ':'')+'--cgroup '+CLASS+' -j RETURN'];}
function resetDirect(prefix,value,ipv6){
    var p=preferences(value);if(!selective(p))return [];
    // Connections redirected under the previous policy retain conntrack NAT.
    // Reset only excluded clients of our transparent listener, so their next
    // connection takes the direct route. The core itself bypasses this rule.
    return [prefix+' -m cgroup '+(p.mode==='vpn'?'! ':'')+'--cgroup '+CLASS+' -d '+(ipv6?'::1/128':'127.0.0.1/32')+' -p tcp --dport '+(ipv6?ports.tcp6:ports.tcp)+' -j REJECT --reject-with tcp-reset'];
}
function enter(command){return 'sh -c '+q('echo $$ > '+q(GROUP+'/cgroup.procs')+' && exec '+command);}
module.exports={preferences:preferences,selected:selected,selective:selective,policyKey:policyKey,validId:validId,registryCommand:registryCommand,parseRegistry:parseRegistry,prepare:prepare,cleanup:cleanup,Monitor:Monitor,guards:guards,resetDirect:resetDirect,enter:enter,group:GROUP,classId:CLASS};
