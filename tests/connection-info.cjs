const assert=require('node:assert/strict'),net=require('node:net');
const info=require('../app/service/connection-info');
const v4='0A7100CB',v6='B80D0120000000000000000001000000';
assert.equal(info.procAddress(v4,4),'203.0.113.10');
assert.equal(info.procAddress(v6,6),'2001:db8::1');
assert.equal(info.procAddress('broken',4),null);
const row=(remote,state,inode)=>`0: 0100007F:C001 ${remote}:01BB ${state} 0:0 0:0 0 0 0 ${inode} 1`;
const snapshot=['socket:[42]','socket:[43]','SEVER_TCP4',row(v4,'01',42),row('08080808','01',99),row('01010101','0A',42),'SEVER_TCP6',row(v6,'01',43)].join('\n');
assert.deepEqual(info.peers(snapshot,443),[{ip:'203.0.113.10',family:4,port:443},{ip:'2001:db8::1',family:6,port:443}]);
assert.deepEqual(info.peers(snapshot,8443),[]);
assert.deepEqual(info.pingResult('64 bytes: seq=0 ttl=54 time=27.25 ms'),{latencyMs:27.25,latencyKind:'ICMP',upperBound:false});
assert.deepEqual(info.pingResult('time<1 ms'),{latencyMs:1,latencyKind:'ICMP',upperBound:true});
assert.equal(info.pingResult('100% packet loss'),null);
(async()=>{
 let commands=[];const root=async cmd=>{commands.push(cmd);return commands.length===1?snapshot:'time=26.2 ms';};
 const result=await info.measure(root,'/tmp/sever','/tmp/core',{host:'example.com',port:443},true);
 assert.equal(result.serverIP,'203.0.113.10');assert.equal(result.latencyMs,26.2);assert.equal(result.latencyKind,'ICMP');
 const noPeer=await info.measure(async()=>'', '/tmp/sever','/tmp/core',{host:'203.0.113.10',port:443},false);
 assert.equal(noPeer.serverIP,null,'A configured address is not proof of an established socket');
 const server=net.createServer(s=>s.end());await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const port=server.address().port;
 try{const r=await info.tcpPing('127.0.0.1',port);assert.equal(r.latencyKind,'TCP');assert.ok(r.latencyMs>=0&&r.latencyMs<3000);const p=await info.probe({id:'offline',host:'127.0.0.1',port});assert.equal(p.profileId,'offline');assert.equal(p.serverIP,'127.0.0.1');assert.equal(p.reachable,true);assert.equal(p.latencyKind,'TCP');}finally{await new Promise(r=>server.close(r));}
 const unavailable=await info.probe({id:'offline',host:'127.0.0.1',port});assert.equal(unavailable.serverIP,'127.0.0.1');assert.equal(unavailable.reachable,false);assert.equal(unavailable.latencyMs,null);
 const server6=net.createServer(s=>s.end());await new Promise((resolve,reject)=>{server6.once('error',reject);server6.listen({port:0,host:'::1',ipv6Only:true},resolve);});
 try{const r=await info.probe({id:'six',host:'[::1]',port:server6.address().port},null,'ipv6');assert.equal(r.family,6);assert.equal(r.serverIP,'::1');assert.equal(r.reachable,true);await assert.rejects(info.probe({host:'::1',port:443},null,'ipv4'),/нет IPv4/);}finally{await new Promise(r=>server6.close(r));}
 const dns=require('node:dns'),lookup=dns.lookup,attempts=[];dns.lookup=(host,opts,cb)=>cb(null,[{address:'192.0.2.1',family:4},{address:'2001:db8::1',family:6}]);
 try{const r=await info.probe({id:'dns',host:'test.invalid',port:443},async ip=>{attempts.push(ip);return {latencyMs:10};},'ipv6');assert.deepEqual(attempts,['2001:db8::1']);assert.equal(r.family,6);}finally{dns.lookup=lookup;}
 console.log('Actual socket ownership, real IPv4/IPv6 TCP probes, strict DNS-family selection and ICMP/TCP parsing: passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
