'use strict';
var ports=require('./ports').values;
var apps=require('./app-proxy');
var GROUP='/sys/fs/cgroup/net_cls/tizyp-xray',CLASS=22334,NAT='TIZYP_TV_NAT',FILTER='TIZYP_TV_OUT';
var LAN4=['0.0.0.0/8','10.0.0.0/8','100.64.0.0/10','127.0.0.0/8','169.254.0.0/16','172.16.0.0/12','192.168.0.0/16','224.0.0.0/4','240.0.0.0/4'];
var LAN6=['::/128','::1/128','fe80::/10','fc00::/7','ff00::/8'];
function q(s){return "'"+String(s).replace(/'/g,"'\\''")+"'";}
function cleanup(){return [['iptables','nat',NAT],['iptables','filter',FILTER],['ip6tables','filter',FILTER]].map(function(x){var p=x[0]+' -t '+x[1];return 'while '+p+' -D OUTPUT -j '+x[2]+' 2>/dev/null; do :; done; '+p+' -F '+x[2]+' 2>/dev/null; '+p+' -X '+x[2]+' 2>/dev/null; true';}).join('\n');}
function prepare(){return 'test -f /sys/fs/cgroup/net_cls/net_cls.classid && mkdir -p '+q(GROUP)+' && chmod 700 '+q(GROUP)+' && echo '+CLASS+' > '+q(GROUP+'/net_cls.classid');}
function preflight(){return 'iptables -t nat -S OUTPUT >/dev/null && iptables -t filter -S OUTPUT >/dev/null && ip6tables -t filter -S OUTPUT >/dev/null && test -f /sys/fs/cgroup/net_cls/net_cls.classid';}
function install(appProxy){
 var s=[cleanup(),'set -e','sever_rules_ok=0','trap '+q('if test "$sever_rules_ok" -ne 1; then '+cleanup()+'; fi')+' EXIT'];
 var n='iptables -t nat -A '+NAT,f='iptables -t filter -A '+FILTER,f6='ip6tables -t filter -A '+FILTER;
 s.push('iptables -t nat -N '+NAT,'iptables -t filter -N '+FILTER,'ip6tables -t filter -N '+FILTER);
 [n,f,f6].forEach(function(p){s.push(p+' -m cgroup --cgroup '+CLASS+' -j RETURN');});
 s=s.concat(apps.resetDirect(f,appProxy,false),apps.resetDirect(f6,appProxy,true));
 // App exclusions must precede DNS redirects and IPv4/IPv6/QUIC rejects.
 [n,f,f6].forEach(function(p){s=s.concat(apps.guards(p,appProxy));});
 // REJECT replies target the TV's own global IPv6 on lo; permit those replies
 // so clients receive an immediate error and fall back to IPv4.
 s.push(f6+' -o lo -j RETURN');
 s.push(n+' -d 127.0.0.0/8 -j RETURN');
 ['udp','tcp'].forEach(function(p){s.push(n+' -p '+p+' --dport 53 -j REDIRECT --to-ports '+ports.dns+'');});
 LAN4.forEach(function(ip){s.push(n+' -d '+ip+' -j RETURN',f+' -d '+ip+' -j RETURN');});
 s.push(n+' -p tcp -j REDIRECT --to-ports '+ports.tcp+'');
 // Reject existing direct TCP sessions too: new sessions then receive the NAT redirect.
 s.push(f+' -p tcp -j REJECT --reject-with tcp-reset',f+' -p udp -j REJECT --reject-with icmp-port-unreachable');
 s.push(f6+' -d ::1/128 -j RETURN');
 // A link-local router can be a resolver; do not let DNS escape through that exception.
 s.push(f6+' -p udp --dport 53 -j REJECT --reject-with icmp6-port-unreachable',f6+' -p tcp --dport 53 -j REJECT --reject-with tcp-reset');
 LAN6.forEach(function(ip){s.push(f6+' -d '+ip+' -j RETURN');});
 s.push(f6+' -p tcp -j REJECT --reject-with tcp-reset',f6+' -p udp -j REJECT --reject-with icmp6-port-unreachable',f6+' -j REJECT --reject-with icmp6-adm-prohibited');
 s.push('iptables -t nat -I OUTPUT 1 -j '+NAT,'iptables -t filter -I OUTPUT 1 -j '+FILTER,'ip6tables -t filter -I OUTPUT 1 -j '+FILTER,'sever_rules_ok=1');
 return s.join('\n');
}
function verify(){return 'iptables -t nat -C OUTPUT -j '+NAT+' && iptables -t filter -C OUTPUT -j '+FILTER+' && ip6tables -t filter -C OUTPUT -j '+FILTER;}
function enter(command){return 'sh -c '+q('echo $$ > '+q(GROUP+'/tasks')+' && exec '+command);}
function removeGroup(){return apps.cleanup()+'\nrmdir '+q(GROUP)+' 2>/dev/null || true';}
function latency(ip,port){return enter('curl --connect-timeout 3 --max-time 3 -s -o /dev/null -w '+q('SEVER_CONNECT:%{time_connect}')+' '+q('telnet://'+(ip.indexOf(':')>=0?'['+ip+']':ip)+':'+port))+' 2>/dev/null || true';}
module.exports={cleanup:cleanup,prepare:prepare,preflight:preflight,install:install,verify:verify,enter:enter,removeGroup:removeGroup,latency:latency,group:GROUP,classId:CLASS};
