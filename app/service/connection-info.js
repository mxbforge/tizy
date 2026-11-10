'use strict';
var ipFamily=require('./ip-family');
var net=require('net'),dns=require('dns'),ipaddr=require('ipaddr.js'),network=require('./network'),tvNetwork=require('./network-tv');
function procAddress(hex,family){
    if(!/^[0-9a-f]+$/i.test(hex) || hex.length!==(family===4?8:32))return null;
    var bytes=Buffer.from(hex,'hex'),ordered=[];
    for(var i=0;i<bytes.length;i+=4)ordered.push(bytes[i+3],bytes[i+2],bytes[i+1],bytes[i]);
    return ipaddr.process(ipaddr.fromByteArray(ordered).toString()).toString();
}
function peers(text,port){
    var ids=Object.create(null),result=[],seen=Object.create(null),family=0;
    text.split('\n').forEach(function(line){var m=/^socket:\[(\d+)\]$/.exec(line.trim());if(m)ids[m[1]]=true;});
    text.split('\n').forEach(function(line){
        if(line==='SEVER_TCP4'){family=4;return;}if(line==='SEVER_TCP6'){family=6;return;}if(!family)return;
        var cols=line.trim().split(/\s+/);if(cols.length<10 || cols[3]!=='01' || !ids[cols[9]])return;
        var endpoint=cols[2].split(':');if(parseInt(endpoint[1],16)!==port)return;
        var ip=procAddress(endpoint[0],family);if(!ip||seen[ip])return;seen[ip]=true;result.push({ip:ip,family:net.isIP(ip),port:port});
    });return result;
}
function snapshotCommand(dir,core){return '( '+network.verifyPid(dir,core)+'; echo SEVER_FDS; for sever_fd in /proc/$p/fd/*; do readlink "$sever_fd" 2>/dev/null || true; done; echo SEVER_TCP4; cat /proc/$p/net/tcp; echo SEVER_TCP6; cat /proc/$p/net/tcp6; )';}
function pingResult(text){var m=/time([=<])\s*([0-9.]+)\s*ms/i.exec(text);return m?{latencyMs:Number(m[2]),latencyKind:'ICMP',upperBound:m[1]==='<'}:null;}
function tcpPing(ip,port){return new Promise(function(resolve){
    var start=process.hrtime(),done=false,socket=net.connect({host:ip,port:port,family:net.isIP(ip)});
    function finish(value){if(done)return;done=true;socket.destroy();resolve(value);}
    socket.setTimeout(3000,function(){finish(null);});socket.on('error',function(){finish(null);});
    socket.on('connect',function(){var delta=process.hrtime(start);finish({latencyMs:Math.round((delta[0]*1000+delta[1]/1e6)*10)/10,latencyKind:'TCP',upperBound:false});});
});}
function measure(root,dir,core,profile,allowTcp,viaGroup){
    return root(snapshotCommand(dir,core)).then(function(text){
        var list=peers(text,profile.port),literal=net.isIP(profile.host),chosen;
        if(literal){var normalized=ipaddr.process(profile.host).toString();chosen=list.filter(function(p){return p.ip===normalized;})[0];}
        else chosen=list[0];
        if(!chosen)return {serverIP:null,latencyMs:null,latencyKind:null,measuredAt:Date.now()};
        var cmd=(chosen.family===6?'ping6':'ping')+' -n -c 1 -W 2 '+network.quote(chosen.ip)+' 2>/dev/null || true';
        return root(cmd).then(function(output){var r=pingResult(output);if(r)return r;if(allowTcp)return tcpPing(chosen.ip,chosen.port);if(viaGroup)return root(tvNetwork.latency(chosen.ip,chosen.port)).then(function(output){var m=/SEVER_CONNECT:([0-9.]+)/.exec(output),v=m?Number(m[1])*1000:0;return v>0?{latencyMs:Math.round(v*10)/10,latencyKind:'TCP',upperBound:false}:null;});return null;}).then(function(r){
            return {serverIP:chosen.ip,serverIPs:list.map(function(p){return p.ip;}),family:chosen.family,latencyMs:r?r.latencyMs:null,latencyKind:r?r.latencyKind:null,upperBound:r?!!r.upperBound:false,measuredAt:Date.now()};
        });
    });
}
function resolveHost(host){host=ipFamily.host(host);return new Promise(function(resolve,reject){
    if(net.isIP(host))return resolve([{address:host,family:net.isIP(host)}]);
    var done=false,timer=setTimeout(function(){if(!done){done=true;reject(new Error('Не удалось определить IP сервера'));}},4000);
    dns.lookup(host,{all:true},function(err,records){if(done)return;done=true;clearTimeout(timer);if(err||!records||!records.length)return reject(new Error('Не удалось определить IP сервера'));var seen=Object.create(null),list=[];records.forEach(function(r){if(net.isIP(r.address)&&!seen[r.address]){seen[r.address]=true;list.push(r);}});if(!list.length)return reject(new Error('Не удалось определить IP сервера'));resolve(list);});
});}
function groupPing(root,ip,port){return root(tvNetwork.latency(ip,port)).then(function(output){var m=/SEVER_CONNECT:([0-9.]+)/.exec(output),v=m?Number(m[1])*1000:0;return v>0?{latencyMs:Math.round(v*10)/10,latencyKind:'TCP',upperBound:false}:null;});}
function probe(profile,ping,family){ping=ping||tcpPing;return resolveHost(profile.host).then(function(addresses){addresses=ipFamily.candidates(addresses,family);
    return Promise.all(addresses.map(function(a){return ping(a.address,profile.port).then(function(result){return {address:a.address,family:a.family,result:result};});})).then(function(results){
        var good=results.filter(function(r){return !!r.result;}).sort(function(a,b){return a.result.latencyMs-b.result.latencyMs;}),chosen=good[0]||results[0],r=chosen.result;
        return {profileId:profile.id,serverIP:chosen.address,serverIPs:addresses.map(function(a){return a.address;}),family:chosen.family,latencyMs:r?r.latencyMs:null,latencyKind:r?'TCP':null,upperBound:false,reachable:!!r,measuredAt:Date.now()};
    });
});}
module.exports={measure:measure,probe:probe,groupPing:groupPing,peers:peers,procAddress:procAddress,pingResult:pingResult,tcpPing:tcpPing};
