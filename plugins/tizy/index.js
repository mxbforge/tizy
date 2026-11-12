'use strict';
// Runs in Vetro itself. No HTTP bridge, WGT service, SDB or companion app.
var net=require('net'),ipFamily=require('./ip-family');
var fs=require('fs'),path=require('path'),crypto=require('crypto'),dns=require('dns'),https=require('https'),url=require('url');
var profiles=require('./profiles'),network=require('./network'),tv=require('./network-tv'),apps=require('./app-proxy');
var Logging=require('./logging');
var i18n=require('./i18n'),qrRuntime=require('./qr-runtime');
var runtime=require('./runtime'),traffic=require('./traffic'),ports=require('./ports').values,q=network.quote,wrap=require('./root-command'),checkTunnel=require('./tunnel-check');
var DATA='/opt/usr/home/owner/share/tizy-shard-data';
var COMMIT='76d1b94b2495f5e475e20086102677e3e59ebdde';
module.exports=function(ctx){
 var activeFile=path.join(ctx.dir,'active.json');
 var config=ctx.config.get()||{},state=config.state||{servers:[],selected:null,settings:{}},running=false,phase='disconnected',ready=false,error='',coreVersion='',timer=null,queue=Promise.resolve(),pending=0,connectedAt=0,stats={},logs=[],logSequence=0,generation=0,healthBusy=false,failures=0,nextRetry=0,retryCount=0,prepared=false,paused=false,wanted=false,lastHealth=0,qrInstances=null,qrLoading=null,qrLoadTask=null,qrActive=false,qrGeneration=0,qrProtocol='incy',qrView={phase:'idle'},routingInProgress=false,selectedPeer=null,peerSerial=0,serverPings={},pingSweep={running:false,total:0,completed:0},pingGeneration=0,pingCancels=[];
 state.settings=state.settings||{};state.servers=state.servers||[];
 state.settings.ipFamily=['auto','ipv4','ipv6'].indexOf(state.settings.ipFamily)>=0?state.settings.ipFamily:'auto';
 state.settings.appProxy=apps.preferences(state.settings.appProxy);
 try{state.settings.log=Logging.preferences(state.settings.log);}catch(ignore){var logEnabled=state.settings.log&&state.settings.log.enabled;state.settings.log=Logging.defaults();if(typeof logEnabled==='boolean')state.settings.log.enabled=logEnabled;}
 if(!i18n.validPreference(state.settings.language))state.settings.language='auto';
 var monitor=new apps.Monitor({onError:function(e){error=e.message;if(routingInProgress)return;enqueue(disconnect).catch(function(){});}});
 function redact(text){text=String(text);state.servers.forEach(function(p){if(p.secret)text=text.split(p.secret).join('[secret]');});return text.replace(/(?:vless|vmess|trojan|ss):\/\/\S+/g,'[profile]').replace(/https:\/\/\S+/g,'[url]').slice(0,400);}
 function log(text,category,level,detail){if(!state.settings.log.enabled)return;category=category||(/серверов|перенесены|переименован|удалён/i.test(text)?'servers':/Xray|пинг|DNS|ядр/i.test(text)?'network':/VPN|подключени/i.test(text)?'connection':'system');var entry={id:++logSequence,time:Date.now(),text:Logging.scrub(redact(text)),category:category,level:level||'info'};if(detail)entry.detail=Logging.scrub(redact(detail));logs.push(entry);if(logs.length>300)logs.shift();}
 function exportLog(scope,language){var t=function(text){return i18n.t(text,language);},prefs=state.settings.log,list=logs.filter(function(event){return scope==='all'||Logging.visible(event,prefs);}),lines=['TIZY Shard — '+t('Журнал'),t('Версия: ')+'0.4.2',t('Создан (UTC): ')+new Date().toISOString(),t('Записей: ')+list.length,t('Режим экспорта: ')+t(scope==='all'?'Весь журнал':'По выбранным фильтрам'),''];list.slice().reverse().forEach(function(event){var level={info:'Информация',debug:'Подробно',warning:'Предупреждение',error:'Ошибка'}[event.level]||'Информация',category={connection:'Подключение',network:'Сеть',servers:'Серверы',system:'Система'}[event.category]||'Система';lines.push(new Date(event.time).toISOString()+' ['+t(level)+'] ['+t(category)+'] '+t(Logging.scrub(Logging.message(event.text))));if(event.detail&&(scope==='all'||prefs.details))lines.push('  '+t(Logging.scrub(event.detail)));});return '\ufeff'+lines.join('\r\n')+'\r\n';}

 function save(){config.state=state;ctx.config.set(config);}
 function root(command,timeout){return Promise.resolve().then(function(){return ctx.execute(wrap(command),timeout||45000);}).then(function(result){if(typeof result==='string')return result;if(!result||result.timed_out||result.exit_code!==0)throw new Error(result&&(result.stderr||result.error)||'Команда root завершилась с ошибкой');return result.stdout||'';});}
 function enqueue(action){pending++;var result=queue.then(action);queue=result.then(function(){pending--;},function(e){pending--;error=redact(e.message);log(error,'system','error');});return result;}
 function write(name,text){fs.writeFileSync(path.join(DATA,name),text,{mode:384});}
 function clearActive(){[activeFile,path.join(DATA,'active.json')].forEach(function(file){try{fs.unlinkSync(file);}catch(e){if(e.code!=='ENOENT')log('Не удалось удалить рабочий конфиг: '+e.message);}});}
 function lease(){write('lease',String(Math.floor(Date.now()/1000)));}
 function snapshot(){return {name:'TIZY',version:'0.4.2',running:running,phase:phase,ready:ready,busy:pending>0,coreVersion:coreVersion,error:error,connectedAt:connectedAt,traffic:stats,serverPings:serverPings,selectedPeer:selectedPeer,pingSweep:pingSweep,settings:state.settings,selected:state.selected,migrated:!!config.migrated,pairing:qrActive?(qrInstances?qrInstances[qrProtocol].view:qrView):{phase:'idle'},pairProtocol:qrProtocol,servers:state.servers.map(function(p){return {id:p.id,name:p.name,protocol:p.protocol,network:p.network,security:p.security,serverIP:net.isIP(ipFamily.host(p.host))?ipFamily.host(p.host):null,family:net.isIP(ipFamily.host(p.host))||null};}),events:logs};}
 function prepare(){
  var core=DATA+'/xray';
  // Only immutable, published TIZY binaries, verified before executable permissions.
  var install=['set -e','umask 077','test ! -L '+q(DATA),'mkdir -p '+q(DATA),'chmod 700 '+q(DATA),'chown '+process.getuid()+':'+process.getgid()+' '+q(DATA),
   'case $(uname -m) in armv7l|armv8l) tizy_name=xray; tizy_hash='+runtime.hashes.armv7+';; aarch64|arm64) tizy_name=xray-arm64; tizy_hash='+runtime.hashes.arm64+';; *) echo Unsupported_architecture >&2; exit 1;; esac',
   'tizy_dst='+q(core)+'; test "$tizy_name" = xray || tizy_dst='+q(core+'-arm64'),
   'if ! printf "%s  %s\\n" "$tizy_hash" "$tizy_dst" | sha256sum -c - >/dev/null 2>&1; then',
   'curl --proto =https --proto-redir =https --tlsv1.2 -fL --connect-timeout 10 --max-time 35 '+q('https://raw.githubusercontent.com/mxbforge/tizy/'+COMMIT+'/app/core/')+'"$tizy_name" -o "$tizy_dst.next"',
   'printf "%s  %s\\n" "$tizy_hash" "$tizy_dst.next" | sha256sum -c - >/dev/null','chmod 700 "$tizy_dst.next"','mv -f "$tizy_dst.next" "$tizy_dst"','fi',runtime.prepare(core),q(runtime.core)+' version'].join('\n');
  ready=false;prepared=false;return root(install,45000).then(function(text){coreVersion=text.trim().split('\n')[0];ready=true;prepared=true;error='';log('Ядро Xray готово','network','debug',coreVersion);});
 }
 function conflict(){
  // Refuse to take over another VPN's rules, including the old TIZY app.
  return root('if iptables -t nat -S OUTPUT | grep -E "SEVER_|NORD|nord|WIREGUARD" >/dev/null; then echo VPN_CONFLICT >&2; exit 1; fi');
 }
 function disconnect(){
  clearActive();cancelPings();monitor.stop();try{write('lease','0');}catch(ignore){}phase='disconnecting';
  return root(network.stop(DATA,runtime.core)).then(function(){phase='disconnected';connectedAt=0;stats={};log('VPN отключён');},function(e){phase='error';throw e;});
 }
 function connect(){
  if(!running)throw new Error('Плагин выключен');
  var p=state.servers.filter(function(s){return s.id===state.selected;})[0];if(!p)throw new Error('Выберите сервер');
  cancelPings();var gen=generation;phase='connecting';error='';log('Подключаемся к серверу: '+p.name,'connection');
  function alive(){if(!running||gen!==generation)throw new Error('Подключение отменено');lease();}
  return conflict().then(function(){return prepared?null:prepare();}).then(function(){alive();return root(tv.preflight());}).then(function(){
   fs.writeFileSync(activeFile,JSON.stringify(profiles.config(p,'tv',state.settings.ipFamily)),{mode:384});write('core.log','');alive();return root(q(runtime.core)+' run -test -c '+q(activeFile));
  }).then(function(){alive();return root(network.start(DATA,runtime.core,'tv',state.settings.appProxy,activeFile));}).then(function(){return new Promise(function(resolve){setTimeout(resolve,1000);});})
  .then(function(){alive();return checkTunnel(function(){return root(tv.enter('curl --connect-timeout 5 --max-time 12 --socks5-hostname 127.0.0.1:'+ports.socks+' -fsS -o /dev/null -w "%{http_code}" https://www.gstatic.com/generate_204'));});})
  .then(function(){alive();monitor.start(state.settings.appProxy);return root(tv.install(state.settings.appProxy));})
  .then(function(){alive();var check='curl -4 --noproxy '+q('*')+' --connect-timeout 5 --max-time 12 -fsS -o /dev/null -w \"%{http_code}\" https://www.gstatic.com/generate_204';if(apps.selective(state.settings.appProxy)&&state.settings.appProxy.mode==='vpn')check=apps.enter(check);return checkTunnel(function(){return root(tv.verify()+' && ( '+network.verifyPid(DATA,runtime.core)+' ) && '+check);});})
  .then(function(){alive();return probeServer(p,true,function(){return running&&gen===generation;}).then(function(result){alive();recordPing(p,result);});})
  .then(function(){alive();clearActive();phase='connected';connectedAt=Date.now();failures=0;retryCount=0;updateSelectedPeer();log('VPN подключён: '+p.name);})
  .catch(function(e){clearActive();monitor.stop();return root(network.stop(DATA,runtime.core)).catch(function(){}).then(function(){phase=running?'error':'disconnected';error=redact(e.message);nextRetry=Date.now()+15000;throw e;});});
 }
 function importText(text,valid){
  if(typeof text!=='string'||text.length>524288)throw new Error('Некорректная ссылка');
  return (/^https:\/\//.test(text.trim())?subscription(text.trim(),0):Promise.resolve(text)).then(function(raw){
   if(valid&&!valid())throw new Error('Передача отменена');var incoming=profiles.parseMany(raw);if(state.servers.length+incoming.length>200)throw new Error('Максимум 200 серверов');
   incoming.forEach(function(p){p.id=crypto.randomBytes(8).toString('hex');p.name=profiles.uniqueName(p.name,state.servers);state.servers.push(p);});if(!state.selected)state.selected=incoming[0].id;save();if(!selectedPeer||selectedPeer.profileId!==state.selected)updateSelectedPeer();log('Добавлено серверов: '+incoming.length);
  });
 }
 function cancelPairing(){if(qrLoadTask){if(qrLoadTask.cancel)qrLoadTask.cancel();qrLoadTask=null;qrLoading=null;}qrGeneration++;qrActive=false;qrView={phase:'idle'};if(qrInstances)Object.keys(qrInstances).forEach(function(id){try{var result=qrInstances[id].cancel();if(result&&result.catch)result.catch(function(){});}catch(ignore){}});}
 function receivePairing(payload,valid){var generation=qrGeneration;function alive(){return running&&qrActive&&generation===qrGeneration&&(!valid||valid());}
  return enqueue(function(){if(!alive())throw new Error('Передача отменена');
   var incoming=payload.profiles||(payload.type==='config'&&Array.isArray(payload.servers)?payload.servers.map(function(p){return profiles.fromIncy(p);}):null);
   if(incoming){if(!incoming.length||state.servers.length+incoming.length>200)throw new Error('Максимум 200 серверов');incoming.forEach(function(p){profiles.config(p,'tv',state.settings.ipFamily);});if(!alive())throw new Error('Передача отменена');incoming.forEach(function(p){p.id=crypto.randomBytes(8).toString('hex');p.name=profiles.uniqueName(p.name,state.servers);state.servers.push(p);});if(!state.selected)state.selected=incoming[0].id;save();if(!selectedPeer||selectedPeer.profileId!==state.selected)updateSelectedPeer();log('Добавлено серверов: '+incoming.length);return;}
   var text=typeof payload==='string'?payload:payload.text||payload.url||(Array.isArray(payload.servers)?payload.servers.join('\n'):null);if(typeof text!=='string')throw new Error('Этот формат передачи пока не поддерживается');
   return Promise.all(text.split('\n').map(function(line){return /^https:\/\//.test(line)?subscription(line,0):Promise.resolve(line);})).then(function(parts){return importText(parts.join('\n'),alive);});
  });
 }
 function startPairing(protocol){if(['incy','happ','v2raytun'].indexOf(protocol)<0)throw new Error('Неизвестный формат QR');cancelPairing();qrActive=true;qrProtocol=protocol;qrView={phase:'starting'};var generation=qrGeneration;
  if(!qrLoading){var task=qrRuntime.load(DATA);qrLoadTask=task;qrLoading=task.then(function(sodium){if(qrLoadTask!==task)throw new Error('Передача отменена');qrLoadTask=null;var types=qrRuntime.create(sodium);qrInstances={incy:new types.Incy(receivePairing),happ:new types.Happ(receivePairing),v2raytun:new types.V2RayTun(receivePairing)};},function(e){if(qrLoadTask===task){qrLoadTask=null;qrLoading=null;}throw e;});}
  return qrLoading.then(function(){if(!running||generation!==qrGeneration)throw new Error('Передача отменена');return qrInstances[protocol].start();}).catch(function(e){if(generation===qrGeneration){qrView={phase:'error',error:redact(e.message)};if(qrInstances)qrInstances[protocol].view=qrView;}throw e;});
 }
 function public4(ip){try{return require('./ipaddr').process(ip).range()==='unicast';}catch(e){return false;}}
 function subscription(address,depth){return new Promise(function(resolve,reject){
  var u=url.parse(address);if(u.protocol!=='https:'||u.auth||!u.hostname||(u.port&&u.port!=='443')||depth>3)return reject(new Error('Нужна публичная HTTPS-подписка на порту 443'));
  // Pin a validated address to prevent DNS rebinding and LAN subscription requests.
  dns.lookup(u.hostname,{family:4},function(e,ip){if(e||!public4(ip))return reject(new Error('Адрес подписки недоступен или относится к локальной сети'));
   var request=https.get({hostname:ip,servername:u.hostname,path:u.path,headers:{Host:u.hostname,'User-Agent':'TIZY-Shard/0.4.2'}},function(res){
    if([301,302,303,307,308].indexOf(res.statusCode)>=0){res.resume();return subscription(url.resolve(address,res.headers.location||''),depth+1).then(resolve,reject);}
    if(res.statusCode!==200){res.resume();return reject(new Error('Подписка: HTTP '+res.statusCode));}
    var parts=[],size=0;res.on('data',function(chunk){size+=chunk.length;if(size>524288){request.abort();reject(new Error('Подписка превышает 512 КБ'));}else parts.push(chunk);});res.on('error',reject);res.on('aborted',function(){reject(new Error('Загрузка подписки прервана'));});res.on('end',function(){resolve(Buffer.concat(parts).toString('utf8'));});
   });request.on('error',reject);request.setTimeout(10000,function(){request.abort();reject(new Error('Время ожидания подписки истекло'));});
  });
 });}
 function migrate(){
  if(state.servers.length)throw new Error('Для переноса список серверов плагина должен быть пуст');
  if(phase==='connected'||phase==='connecting'||phase==='disconnecting')throw new Error('Сначала отключите VPN');
  var raw;try{raw=fs.readFileSync('/opt/usr/home/owner/apps_rw/severtvapp/data/profiles.json','utf8');}catch(e){if(e.code==='ENOENT')throw new Error('Данные отдельного приложения TIZY не найдены на ТВ');throw e;}var old=JSON.parse(raw),appearance=state.settings.tileAppearance;
  if(!Array.isArray(old.servers)||old.servers.length>200)throw new Error('Некорректный старый список');
  old.servers.forEach(function(p){profiles.config(p,'tv',old.settings&&old.settings.ipFamily||'auto');});
  state={servers:old.servers,selected:old.servers.some(function(p){return p.id===old.selected;})?old.selected:(old.servers[0]?old.servers[0].id:null),settings:old.settings||{}};state.settings.appProxy=apps.preferences(state.settings.appProxy);try{state.settings.log=Logging.preferences(state.settings.log);}catch(ignore){state.settings.log=Logging.defaults();}if(appearance)state.settings.tileAppearance=appearance;config.migrated=true;save();updateSelectedPeer();log('Серверы и настройки перенесены из TIZY');
 }
 function tick(){
  if(!running)return;
  if(phase==='connecting'||phase==='connected')try{lease();}catch(e){error=redact(e.message);}
  if(pending||healthBusy)return;
  if(!paused&&(wanted||state.settings.autoConnect)&&state.selected&&phase!=='connected'&&Date.now()>=nextRetry&&retryCount<3){retryCount++;nextRetry=Date.now()+30000;enqueue(connect).catch(function(){});return;}
  if(phase!=='connected')return;
  healthBusy=true;var gen=generation;
  root('( '+network.verifyPid(DATA,runtime.core)+' ) && '+tv.verify()+' && '+traffic.command(runtime.core),10000).then(function(text){
   if(gen!==generation||phase!=='connected')return;stats=traffic.sample(traffic.parse(text),stats.measuredAt?stats:null,Date.now());
   if(Date.now()-lastHealth<30000)return;lastHealth=Date.now();
   return checkTunnel(function(){return root(tv.enter('curl --connect-timeout 5 --max-time 12 --socks5-hostname 127.0.0.1:'+ports.socks+' -fsS -o /dev/null -w "%{http_code}" https://www.gstatic.com/generate_204'));});
  }).then(function(){if(gen===generation&&phase==='connected')failures=0;},function(e){if(gen!==generation||phase!=='connected')return;if(++failures>=2){error=redact(e.message);enqueue(disconnect).catch(function(){});}}).then(function(){healthBusy=false;},function(){healthBusy=false;});
 }
 function configureRouting(value){monitor.stop();generation++;return root(apps.cleanup()+'\n'+(value.enabled?apps.prepare():'true')).then(function(){monitor.start(value);return root(tv.install(value));}).then(function(){return root('( '+network.verifyPid(DATA,runtime.core)+' ) && '+tv.verify());}).then(function(){if(monitor.error)throw new Error(monitor.error);});}
 function saveSettings(b){
  if((phase==='connecting'||phase==='disconnecting')&&(b.ipFamily!==undefined||b.autoConnect!==undefined||b.appProxy!==undefined))throw new Error('Дождитесь завершения подключения');
  if(phase==='connected'&&b.ipFamily!==undefined&&b.ipFamily!==state.settings.ipFamily)throw new Error('Сначала отключите VPN для изменения настроек');
  if(b.tileAppearance!==undefined){var appearance=b.tileAppearance;if(!appearance||Array.isArray(appearance)||typeof appearance.color!=='string'||!/^#[0-9a-fA-F]{6}$/.test(appearance.color)||typeof appearance.opacity!=='number'||!isFinite(appearance.opacity)||appearance.opacity<0||appearance.opacity>1||(appearance.borderColor!==undefined&&(typeof appearance.borderColor!=='string'||!/^#[0-9a-fA-F]{6}$/.test(appearance.borderColor))))throw new Error('Некорректный цвет или прозрачность');}
  if(b.log!==undefined)Logging.preferences(b.log);
  if(b.language!==undefined&&!i18n.validPreference(b.language))throw new Error('Некорректный язык');
  if(b.ipFamily!==undefined&&['auto','ipv4','ipv6'].indexOf(b.ipFamily)<0)throw new Error('Некорректный тип IP');
  if(b.autoConnect!==undefined&&typeof b.autoConnect!=='boolean')throw new Error('Некорректное автоподключение');
  var previous=JSON.parse(JSON.stringify(state.settings)),next=state.settings.appProxy;if(b.appProxy!==undefined){apps.preferences(b.appProxy);var merged=JSON.parse(JSON.stringify(next));['enabled','mode','direct','vpn'].forEach(function(key){if(b.appProxy[key]!==undefined)merged[key]=b.appProxy[key];});next=apps.preferences(merged);}var needsApply=phase==='connected'&&apps.policyKey(next)!==apps.policyKey(previous.appProxy);
  var validate=b.appProxy===undefined||(b.appProxy.direct===undefined&&b.appProxy.vpn===undefined)?Promise.resolve():root(apps.registryCommand()).then(function(text){var allowed=apps.parseRegistry(text).map(function(p){return p.id;});['direct','vpn'].forEach(function(mode){if(next[mode].some(function(id){return allowed.indexOf(id)<0&&previous.appProxy[mode].indexOf(id)<0;}))throw new Error('Приложение отсутствует в списке ТВ');});});
  return validate.then(function(){if(needsApply){routingInProgress=true;cancelPings();return configureRouting(next);}}).then(function(){
   if(b.log!==undefined){var nextLog=Logging.preferences(b.log);if(state.settings.log.enabled&&!nextLog.enabled)log('Запись журнала выключена','system');state.settings.log=nextLog;}if(b.tileAppearance!==undefined)state.settings.tileAppearance={color:b.tileAppearance.color.toLowerCase(),opacity:b.tileAppearance.opacity,borderColor:(b.tileAppearance.borderColor||(previous.tileAppearance||{}).borderColor||'#8faad2').toLowerCase()};if(b.language!==undefined)state.settings.language=b.language;if(b.ipFamily!==undefined&&b.ipFamily!==state.settings.ipFamily){state.settings.ipFamily=b.ipFamily;cancelPings();serverPings={};updateSelectedPeer();}if(b.autoConnect!==undefined){state.settings.autoConnect=b.autoConnect;paused=false;}state.settings.appProxy=next;save();error='';retryCount=0;routingInProgress=false;if(b.log!==undefined&&state.settings.log.enabled)log(previous.log.enabled?'Настройки журнала обновлены':'Запись журнала включена','system');
  }).catch(function(e){state.settings=previous;if(!routingInProgress)throw e;return configureRouting(previous.appProxy).catch(function(){return disconnect();}).then(function(){routingInProgress=false;throw e;},function(){routingInProgress=false;throw e;});});
 }
 function cancelPings(){pingGeneration++;pingSweep.running=false;pingCancels.slice().forEach(function(cancel){cancel();});}
 function resolvePing(host){host=ipFamily.host(host);if(net.isIP(host))return Promise.resolve([{address:host,family:net.isIP(host)}]);return new Promise(function(resolve,reject){var done=false,timer;function finish(e,records){if(done)return;done=true;clearTimeout(timer);var i=pingCancels.indexOf(cancel);if(i>=0)pingCancels.splice(i,1);if(e)reject(e);else resolve(records);}function cancel(){finish(new Error('DNS cancelled'));}pingCancels.push(cancel);timer=setTimeout(function(){finish(new Error('DNS timeout'));},4000);dns.lookup(host,{all:true},function(e,records){finish(e||(!records||!records.length?new Error('DNS empty'):null),records);});});}
 function updateSelectedPeer(){var serial=++peerSerial,p=state.servers.filter(function(p){return p.id===state.selected;})[0],choice=state.settings.ipFamily;selectedPeer=null;if(!running||!p)return;resolvePing(p.host).then(function(records){if(!running||serial!==peerSerial||p.id!==state.selected||choice!==state.settings.ipFamily)return;var record=ipFamily.candidates(records,choice)[0];selectedPeer={profileId:p.id,serverIP:record.address,family:record.family};}).catch(function(){});}
 function tcpPing(ip,port){return new Promise(function(resolve){var start=process.hrtime(),done=false,socket;function finish(value){if(done)return;done=true;var at=pingCancels.indexOf(cancel);if(at>=0)pingCancels.splice(at,1);if(socket)socket.destroy();resolve(value);}function cancel(){finish(null);}pingCancels.push(cancel);try{socket=net.connect({host:ip,port:port,family:net.isIP(ip)});socket.setTimeout(3000,function(){finish(null);});socket.on('error',function(){finish(null);});socket.on('connect',function(){var delta=process.hrtime(start);finish(Math.round((delta[0]*1000+delta[1]/1e6)*10)/10);});}catch(e){finish(null);}});}
 function probeServer(profile,bypass,valid){return resolvePing(profile.host).then(function(records){return Promise.all(ipFamily.candidates(records,state.settings.ipFamily).map(function(record){if(!valid())return null;var task=bypass?root(tv.latency(record.address,profile.port),5000).then(function(text){var m=/SEVER_CONNECT:([0-9.]+)/.exec(text),value=m?Number(m[1])*1000:0;return value>0?Math.round(value*10)/10:null;},function(){return null;}):tcpPing(record.address,profile.port);return task.then(function(value){return {latencyMs:value,serverIP:record.address,family:record.family};});}));}).then(function(values){values=values.filter(function(v){return !!v;});var good=values.filter(function(v){return typeof v.latencyMs==='number';});good.sort(function(a,b){return a.latencyMs-b.latencyMs;});return good[0]||values[0]||null;},function(){return null;});}
 function recordPing(profile,result){var value=result?result.latencyMs:null;serverPings[profile.id]={latencyMs:value,latencyKind:'TCP',reachable:typeof value==='number',serverIP:result?result.serverIP:null,family:result?result.family:null,measuredAt:Date.now()};log(typeof value==='number'?'Пинг сервера обновлён':'Сервер не ответил на проверку','network',typeof value==='number'?'debug':'warning',profile.name+(typeof value==='number'?' · TCP '+value+' мс':''));}
 function pingServers(){if(pingSweep.running)return;if(phase==='connecting'||phase==='disconnecting')throw new Error('Дождитесь завершения подключения');var list=state.servers.slice(),serial=++pingGeneration,next=0;if(!list.length)throw new Error('Добавьте серверы');serverPings={};pingSweep={running:true,total:list.length,completed:0};
  function worker(){if(!running||serial!==pingGeneration||next>=list.length)return Promise.resolve();var profile=list[next++];return probeServer(profile,phase==='connected',function(){return running&&serial===pingGeneration;}).then(function(result){if(!running||serial!==pingGeneration)return;if(state.servers.some(function(p){return p.id===profile.id;}))recordPing(profile,result);pingSweep.completed++;if(pingSweep.completed>=pingSweep.total)pingSweep.running=false;return worker();});}

  for(var i=0;i<Math.min(3,list.length);i++)worker().catch(function(){if(serial===pingGeneration)pingSweep.running=false;});
 }
 function action(sub,b){
  if(!running)throw new Error('Плагин выключен');
  if(sub==='connect'){retryCount=0;paused=false;wanted=true;return connect();}
  if(sub==='disconnect'){paused=true;wanted=false;return disconnect();}
  if(sub==='prepare')return prepare();
  if(sub==='refresh'){if(phase==='connecting'||phase==='disconnecting')throw new Error('Дождитесь завершения подключения');if(phase!=='connected')return prepare();return root(q(runtime.core)+' version && '+tv.preflight()+' && ( '+network.verifyPid(DATA,runtime.core)+' ) && '+tv.verify()).then(function(text){coreVersion=text.trim().split('\n')[0];ready=true;error='';},function(e){ready=false;throw e;});}
  if(sub==='migrate')return migrate();
  if(sub==='import')return importText(b.text);
  if(sub==='pair/start')return startPairing(b.protocol||'incy').then(function(){});
  if(sub==='applications')return root(apps.registryCommand()).then(function(text){return {applications:apps.parseRegistry(text)};});
  if(sub==='logs/clear'){logs=[];return;}
  if(sub==='rename'){
   var server=state.servers.filter(function(p){return p.id===b.id;})[0];if(!server)throw new Error('Сервер не найден');
   if(typeof b.name!=='string'||!b.name.trim()||b.name.trim().length>100||/[\x00-\x1f\x7f]/.test(b.name))throw new Error('Введите название от 1 до 100 символов');
   server.name=b.name.trim();save();log('Сервер переименован','servers','info',server.name);return;
  }
  if(sub==='delete'){
   if(!state.servers.some(function(p){return p.id===b.id;}))throw new Error('Сервер не найден');
   if(state.servers.length===1&&phase!=='disconnected')throw new Error('Для удаления сервера отключите VPN');
   if(state.selected===b.id&&state.servers.length>1)throw new Error('Нельзя удалить активный сервер');
   var last=state.servers.length===1;function removeServer(){cancelPings();delete serverPings[b.id];state.servers=state.servers.filter(function(p){return p.id!==b.id;});if(!state.servers.length){state.selected=null;selectedPeer=null;peerSerial++;}save();error='';log('Сервер удалён','servers');}
   if(last){paused=true;wanted=false;generation++;retryCount=0;}
   removeServer();return;
  }
  if(sub==='select'){
   if(phase==='connected'||phase==='connecting')throw new Error('Сначала отключите VPN');
   if(!state.servers.some(function(p){return p.id===b.id;}))throw new Error('Сервер не найден');
   state.selected=b.id;save();updateSelectedPeer();return;
  }
  if(sub==='settings')return saveSettings(b);
  if(sub==='ping')return pingServers();
  throw new Error('Неизвестная операция');
 }
 function json(res,code,value){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));}
 return {
  start:function(){if(running)return;clearActive();running=true;generation++;log('TIZY работает внутри Vetro');timer=setInterval(tick,5000);if(timer.unref)timer.unref();
   // Clean stale plugin rules only; never alter the standalone app's connection.
   enqueue(function(){return root(network.stop(DATA,runtime.core)).then(function(){updateSelectedPeer();});}).catch(function(){});
  },
  stop:function(){clearActive();cancelPings();cancelPairing();running=false;generation++;if(timer)clearInterval(timer);timer=null;monitor.stop();try{write('lease','0');}catch(ignore){}enqueue(disconnect).catch(function(){});},
  status:function(){return snapshot();},
  route:function(req,res,sub){
   sub=String(sub).split('?')[0];
   if(req.method==='GET'&&sub==='ui'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(fs.readFileSync(path.join(ctx.dir,'ui.html'),'utf8'));return true;}
   if(req.method==='GET'&&(sub==='i18n.js'||sub==='i18n-locales.js'||sub==='logging.js')){res.writeHead(200,{'Content-Type':'application/javascript; charset=utf-8','Cache-Control':'no-store'});res.end(fs.readFileSync(path.join(ctx.dir,sub),'utf8'));return true;}
   var exportMatch=/^logs\/export\/(all|filtered)\/(ru|en|tr|zh-Hans)$/.exec(sub);if(req.method==='GET'&&exportMatch){var text=exportLog(exportMatch[1],exportMatch[2]),filename='TIZY-log-'+new Date().toISOString().replace(/[:.]/g,'-')+'.txt';res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8','Content-Disposition':'attachment; filename="'+filename+'"','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Length':Buffer.byteLength(text)});res.end(text);return true;}
   if(req.method==='GET'&&sub==='state'){json(res,200,snapshot());return true;}
   if(req.method==='POST'&&sub==='pair/cancel'){if(req.resume)req.resume();cancelPairing();json(res,200,snapshot());return true;}
   if(req.method!=='POST'||['logs/clear','ping','pair/start','connect','disconnect','refresh','prepare','migrate','import','select','delete','rename','settings','applications'].indexOf(sub)<0)return false;
   if(pending&&sub!=='pair/start'){json(res,409,{error:'Дождитесь завершения операции'});return true;}
   var data='',tooLarge=false;req.on('error',function(){});req.on('data',function(b){if(tooLarge)return;data+=b;if(Buffer.byteLength(data)>524288){tooLarge=true;data='';}});
   req.on('end',function(){if(tooLarge)return json(res,413,{error:'Слишком большой запрос'});var b;try{b=JSON.parse(data||'{}');if(!b||typeof b!=='object'||Array.isArray(b))throw new Error();}catch(e){json(res,400,{error:'Некорректный JSON'});return;}
    (sub==='pair/start'?Promise.resolve().then(function(){return action(sub,b);}):enqueue(function(){return action(sub,b);})).then(function(extra){json(res,200,extra||snapshot());},function(e){json(res,400,{error:redact(e.message)});});
   });return true;
  }
 };
};
