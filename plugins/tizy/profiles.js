'use strict';
var ports=require('./ports').values;
var url = require('url'),ipFamily=require('./ip-family');
function fail(s) { throw new Error(s); }
function b64(s) { return new Buffer(s.replace(/-/g,'+').replace(/_/g,'/'), 'base64').toString('utf8'); }
function check(p) {
    if(p && typeof p.network==='string'){p.network=p.network.toLowerCase();if(p.network==='raw')p.network='tcp';if(p.network==='splithttp')p.network='xhttp';}
    if(p && typeof p.security==='string')p.security=p.security.toLowerCase();
    if (!p || ['vless','trojan','vmess','shadowsocks'].indexOf(p.protocol) < 0) fail('Поддерживаются VLESS, Trojan, VMess и Shadowsocks');
    if (typeof p.host !== 'string' || !p.host || p.host.length > 253 || /[\s/\\\x00-\x1f]/.test(p.host)) fail('Некорректный адрес сервера');
    p.host=ipFamily.host(p.host);if(p.sni)p.sni=ipFamily.host(p.sni);
    if (!(p.port >= 1 && p.port <= 65535 && Math.floor(p.port) === p.port)) fail('Некорректный порт');
    if (typeof p.secret!=='string' || !p.secret || p.secret.length > 2048) fail('Отсутствует ключ подключения');
    if (['vless','vmess'].indexOf(p.protocol) >= 0 && !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(p.secret)) fail('Некорректный UUID');
    if (['tcp','ws','grpc','xhttp'].indexOf(p.network) < 0) fail('Этот транспорт пока не поддерживается: ' + p.network);
    if (['none','tls','reality'].indexOf(p.security) < 0) fail('Этот тип защиты пока не поддерживается');
    if (p.security === 'reality' && !p.publicKey) fail('Для Reality нужен публичный ключ pbk');
    p.name = String(p.name || p.host).slice(0,100); return p;
}
function parse(line) {
    line = line.trim(); var p, a, q, m;
    if (line.indexOf('vmess://') === 0) {
        a=JSON.parse(b64(line.slice(8))); p={protocol:'vmess',host:a.add,port:Number(a.port),secret:a.id,name:a.ps,network:a.net || 'tcp',security:a.tls === 'tls' ? 'tls':'none',sni:a.sni || a.host || a.add,path:a.path || '/',wsHost:a.host || '',grpcService:a.path || '',cipher:a.scy || 'auto'};
    } else if (line.indexOf('ss://') === 0) {
        a=line.slice(5); var hash=a.indexOf('#'), name=hash>=0?decodeURIComponent(a.slice(hash+1)):''; a=hash>=0?a.slice(0,hash):a;
        if (a.indexOf('?')>=0) fail('Плагины Shadowsocks пока не поддерживаются');
        if (a.indexOf('@')<0) a=b64(a);
        var at=a.lastIndexOf('@'); if(at<0) fail('Некорректная ссылка Shadowsocks');
        var cred=a.slice(0,at); if(cred.indexOf(':')<0) cred=b64(cred);
        var sep=cred.indexOf(':'), addr=url.parse('http://'+a.slice(at+1));
        p={protocol:'shadowsocks',host:addr.hostname,port:Number(addr.port),method:cred.slice(0,sep),secret:decodeURIComponent(cred.slice(sep+1)),name:name,network:'tcp',security:'none'};
    } else {
        m=/^(vless|trojan):\/\/([^@]+)@(.+)$/.exec(line); if(!m) fail('Нужна ссылка VLESS, Trojan, VMess или Shadowsocks');
        a=url.parse('http://'+m[3],true); q=a.query;
        p={protocol:m[1],secret:decodeURIComponent(m[2]),host:a.hostname,port:Number(a.port || (m[1]==='trojan'?443:0)),name:a.hash?decodeURIComponent(a.hash.slice(1)):'',network:q.type || 'tcp',security:q.security || (m[1]==='trojan'?'tls':'none'),sni:q.sni || a.hostname,publicKey:q.pbk || '',shortId:q.sid || '',fingerprint:q.fp || 'chrome',flow:q.flow || '',path:q.path || '/',wsHost:q.host || '',grpcService:q.serviceName || '',xhttpMode:q.mode || 'auto'};
        if(q.allowInsecure==='1' || q.insecure==='1') fail('Небезопасная проверка TLS не поддерживается');
        if(q.encryption && q.encryption!=='none') fail('Нестандартное шифрование VLESS пока не поддерживается');
    }
    return check(p);
}
function parseMany(input) {
    input=input.trim(); if(!/^(vless|vmess|trojan|ss):\/\//.test(input)) input=b64(input);
    var lines=input.split(/\r?\n/).filter(function(x){return x.trim() && x.trim()[0]!=='#';});
    if(!lines.length || lines.length>200) fail('Допускается от 1 до 200 серверов');
    return lines.map(parse);
}
function outbound(p,family) {
    check(p);ipFamily.validate(p,family); var st={network:p.network,security:p.security,sockopt:{mark:511,domainStrategy:ipFamily.strategy(family)}}, settings;
    if(p.protocol==='vless' || p.protocol==='vmess') { var u={id:p.secret}; if(p.protocol==='vless') {u.encryption=p.encryption || 'none'; if(p.flow)u.flow=p.flow;} else {u.security=p.cipher || 'auto'; u.alterId=0;}
        settings={vnext:[{address:p.host,port:p.port,users:[u]}]};
    } else { var s={address:p.host,port:p.port,password:p.secret}; if(p.protocol==='shadowsocks')s.method=p.method; settings={servers:[s]}; }
    if(p.security==='tls') st.tlsSettings={serverName:p.sni || p.host,allowInsecure:false,fingerprint:p.fingerprint || 'chrome'};
    if(p.security==='reality') st.realitySettings={serverName:p.sni || p.host,fingerprint:p.fingerprint || 'chrome',password:p.publicKey,shortId:p.shortId || '',spiderX:p.spiderX || '/'};
    if(p.network==='ws') st.wsSettings={path:p.path || '/',headers:{Host:p.wsHost || ipFamily.authority(p.host)}};
    if(p.network==='grpc') st.grpcSettings={serviceName:p.grpcService || ''};
    if(p.network==='xhttp'){st.xhttpSettings={path:p.path || '/',host:p.wsHost || ipFamily.authority(p.host),mode:p.xhttpMode || 'auto'};if(p.xhttpExtra)st.xhttpSettings.extra=ipFamily.extra(p.xhttpExtra,family);}
    return {tag:'proxy',protocol:p.protocol,settings:settings,streamSettings:st};
}
function config(p,mode,family) {
    var c={log:{loglevel:'warning'},inbounds:[{tag:'local-socks',listen:'127.0.0.1',port:ports.socks,protocol:'socks',settings:{auth:'noauth',udp:false}},{tag:'tv-tcp',listen:'127.0.0.1',port:ports.tcp,protocol:'dokodemo-door',settings:{network:'tcp',followRedirect:true},sniffing:{enabled:true,destOverride:['http','tls'],routeOnly:true}},{tag:'tv-tcp6',listen:'::1',port:ports.tcp6,protocol:'dokodemo-door',settings:{network:'tcp',followRedirect:true},sniffing:{enabled:true,destOverride:['http','tls'],routeOnly:true}}],outbounds:[outbound(p,family)]};
    c.stats={};c.api={tag:'stats-api',listen:'127.0.0.1:'+ports.stats,services:['StatsService']};c.policy={system:{statsOutboundUplink:true,statsOutboundDownlink:true}};
    if(mode==='tv'){
        c.inbounds.push({tag:'tv-dns',listen:'127.0.0.1',port:ports.dns,protocol:'dokodemo-door',settings:{network:'tcp,udp',address:'1.1.1.1',port:53}});
        c.outbounds.push({tag:'dns-via-proxy',protocol:'dns',settings:{rewriteNetwork:'tcp',rewriteAddress:'1.1.1.1',rewritePort:53,rules:[{action:'direct'}]},streamSettings:{sockopt:{dialerProxy:'proxy'}}});
        c.routing={rules:[{type:'field',inboundTag:['tv-dns'],outboundTag:'dns-via-proxy'}]};
    }
    return c;
}
function fromIncy(s,depth){
    depth=depth || 0;if(depth>4)fail('Слишком глубокая конфигурация сервера');
    if(typeof s==='string'){if(/^(vless|vmess|trojan|ss):\/\//.test(s))return parse(s);return fromIncy(JSON.parse(s),depth+1);}
    if(!s || typeof s!=='object')fail('Некорректный сервер Incy');
    var link=s.url || s.uri || s.shareLink || s.link;if(typeof link==='string' && /^(vless|vmess|trojan|ss):\/\//.test(link)){var linked=parse(link);if(s.name)linked.name=String(s.name).slice(0,100);return linked;}
    var nested=s.outbound || s.configuration || s.config || s.rawConfig;
    if(nested && (typeof nested==='string'||typeof nested==='object')){var inner=fromIncy(nested,depth+1);if(s.name)inner.name=String(s.name).slice(0,100);return inner;}
    if(Array.isArray(s.outbounds)){var proxy=s.outbounds.filter(function(o){return o && ['vless','vmess','trojan','shadowsocks'].indexOf(o.protocol)>=0;})[0];if(!proxy)fail('В конфигурации нет поддерживаемого прокси-сервера');var converted=fromIncy(proxy,depth+1);if(s.name)converted.name=String(s.name).slice(0,100);return converted;}
    var protocol=String(s.protocol || s.proxyProtocol || s.type || s.proto || s.protocolType || '').toLowerCase().replace(/[^a-z0-9]/g,'');
    var security=s.security || 'none';if(protocol==='vlessreality'){protocol='vless';security='reality';}if(protocol==='ss')protocol='shadowsocks';
    var st=s.streamSettings || {},tls=st.tlsSettings || s.tlsSettings || {},reality=st.realitySettings || s.realitySettings || {},ws=st.wsSettings || {},grpc=st.grpcSettings || {},xhttp=st.xhttpSettings || {};
    var address=s.address || s.serverAddress || (typeof s.server==='string'?s.server:null),port=Number(s.port),secret=s.uuid || s.password || s.userId,flow=s.flow || '',method=s.method;
    if(s.settings){var target,user;if(protocol==='vless'||protocol==='vmess'){target=(s.settings.vnext || [])[0];user=target && (target.users || [])[0];if(!target || !user)fail('В конфигурации нет адреса или UUID');address=target.address;port=Number(target.port);secret=user.id;flow=user.flow || flow;}
        else{target=(s.settings.servers || [])[0];if(!target)fail('В конфигурации нет сервера');address=target.address;port=Number(target.port);secret=target.password;method=target.method || method;}}
    var network=st.network || s.network || s.transport || 'tcp';if(network==='raw')network='tcp';
    var extra=s.xhttpExtra || xhttp.extra;if(typeof extra==='string'){var rawExtra=extra.trim();extra=rawExtra?JSON.parse(/^%7b/i.test(rawExtra)?decodeURIComponent(rawExtra):rawExtra):null;}
    if(extra && (typeof extra!=='object'||Array.isArray(extra)))fail('Некорректные дополнительные параметры XHTTP');
    return check({protocol:protocol,name:s.name || s.remarks || s.tag,host:address,port:port,secret:secret,network:network,security:st.security || security,sni:s.sni || s.serverName || reality.serverName || tls.serverName || address,publicKey:s.publicKey || reality.password || reality.publicKey || '',shortId:s.shortId || reality.shortId || '',fingerprint:s.fingerprint || reality.fingerprint || tls.fingerprint || 'chrome',path:s.path || ws.path || xhttp.path || '/',wsHost:s.host || (ws.headers&&ws.headers.Host) || xhttp.host || '',flow:flow,grpcService:s.serviceName || grpc.serviceName || '',xhttpMode:s.xhttpMode || xhttp.mode || 'auto',xhttpExtra:extra,spiderX:s.spiderX || reality.spiderX || '/',encryption:s.encryption || 'none',method:method || '',cipher:s.cipher || (protocol==='vmess'&&s.encryption) || (user&&user.security) || 'auto'});
}
function uniqueName(name,servers){
    var base=String(name).slice(0,100),candidate=base,index=0;
    while(servers.some(function(p){return p.name===candidate;})){
        var suffix=' ('+(++index)+')';candidate=base.slice(0,100-suffix.length)+suffix;
    }
    return candidate;
}
module.exports={parse:parse,parseMany:parseMany,config:config,fromIncy:fromIncy,uniqueName:uniqueName};
