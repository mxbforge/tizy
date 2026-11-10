'use strict';
var ports=require('./ports').values;
var CHAIN='SEVER_XRAY';
var tv=require('./network-tv');
var apps=require('./app-proxy');
function quote(s){return "'"+String(s).replace(/'/g,"'\\''")+"'";}
function cleanup(){return ['iptables','ip6tables'].map(function(tool){return 'while '+tool+' -t nat -D OUTPUT -p tcp -j '+CHAIN+' 2>/dev/null; do :; done; '+tool+' -t nat -F '+CHAIN+' 2>/dev/null; '+tool+' -t nat -X '+CHAIN+' 2>/dev/null; true';}).join('\n')+'\n'+tv.cleanup();}
function preflight(){return 'iptables -t nat -S OUTPUT >/dev/null && ip6tables -t nat -S OUTPUT >/dev/null';}
function install(){
    var s=[cleanup(),'set -e','iptables -t nat -N '+CHAIN,'iptables -t nat -A '+CHAIN+' -m mark --mark 511 -j RETURN'];
    ['0.0.0.0/8','10.0.0.0/8','100.64.0.0/10','127.0.0.0/8','169.254.0.0/16','172.16.0.0/12','192.168.0.0/16','224.0.0.0/4','240.0.0.0/4'].forEach(function(x){s.push('iptables -t nat -A '+CHAIN+' -d '+x+' -j RETURN');});
    s.push('iptables -t nat -A '+CHAIN+' -j REDIRECT --to-ports '+ports.tcp+'','ip6tables -t nat -N '+CHAIN,'ip6tables -t nat -A '+CHAIN+' -m mark --mark 511 -j RETURN');
    ['::/128','::1/128','fe80::/10','fc00::/7','ff00::/8'].forEach(function(x){s.push('ip6tables -t nat -A '+CHAIN+' -d '+x+' -j RETURN');});
    s.push('ip6tables -t nat -A '+CHAIN+' -j REDIRECT --to-ports '+ports.tcp6+'','iptables -t nat -I OUTPUT 1 -p tcp -j '+CHAIN,'ip6tables -t nat -I OUTPUT 1 -p tcp -j '+CHAIN);return s.join('\n');
}
function verifyPid(dir,core){return 'p=$(cat '+quote(dir+'/xray.pid')+' 2>/dev/null); case "$p" in ""|*[!0-9]*) exit 1;; esac; sever_exe=$(readlink /proc/$p/exe); case "$sever_exe" in '+quote(core || dir+'/xray')+'|'+quote((core || dir+'/xray')+' (deleted)')+') :;; *) exit 1;; esac; kill -0 "$p"';}
function stop(dir,core){
    return cleanup()+'\n'+[
        'sever_supervisor=$(cat '+quote(dir+'/supervisor.pid')+' 2>/dev/null)',
        'case "$sever_supervisor" in ""|*[!0-9]*) sever_supervisor=;; esac',
        'if test -n "$sever_supervisor" && tr "\\000" "\\n" < /proc/$sever_supervisor/cmdline 2>/dev/null | grep -F '+quote(dir+'/active.json')+' >/dev/null; then',
        '  kill -TERM "$sever_supervisor" 2>/dev/null || true',
        '  for sever_wait in 1 2 3 4 5; do kill -0 "$sever_supervisor" 2>/dev/null || break; sleep 1; done',
        '  if kill -0 "$sever_supervisor" 2>/dev/null; then echo "Supervisor has not stopped" >&2; exit 1; fi',
        'fi',
        '( '+verifyPid(dir,core)+' && kill "$p" ) 2>/dev/null || true',
        'rm -f '+quote(dir+'/xray.pid')+' '+quote(dir+'/supervisor.pid'),
        tv.removeGroup(), 'true'
    ].join('\n');
}
function start(dir,core,mode,appProxy){
    var child='';
    // The supervisor owns only our chain. A lost application lease restores the normal network.
    child+='cleanup() { '+cleanup()+'; }; trap '+quote('cleanup; ( '+verifyPid(dir,core)+' && kill "$p" ) 2>/dev/null || true; test -z "$pid" || wait "$pid" 2>/dev/null || true; rm -f '+quote(dir+'/xray.pid')+' '+quote(dir+'/supervisor.pid')+'; '+tv.removeGroup())+' EXIT; trap \'exit 0\' INT TERM; echo $$ > '+quote(dir+'/supervisor.pid')+'; ';
    var launch=quote(core)+' run -c '+quote(dir+'/active.json');
    child+=(mode==='tv'?tv.enter(launch):launch)+' >> '+quote(dir+'/core.log')+' 2>&1 & pid=$!; echo "$pid" > '+quote(dir+'/xray.pid')+'; ';
    child+='while kill -0 "$pid" 2>/dev/null; do now=$(date +%s); lease=$(cat '+quote(dir+'/lease')+' 2>/dev/null); case "$lease" in ""|*[!0-9]*) break;; esac; test "$((now-lease))" -lt 20 || break; sleep 2; done';
    return stop(dir,core)+'\n'+(mode==='tv'?'set -e; '+tv.prepare()+(apps.preferences(appProxy).enabled?' && '+apps.prepare():'')+'\n':'')+'nohup sh -c '+quote(child)+' </dev/null >/dev/null 2>&1 &\ntrue';
}
module.exports={quote:quote,cleanup:cleanup,preflight:preflight,install:install,start:start,stop:stop,verifyPid:verifyPid,chain:CHAIN};
