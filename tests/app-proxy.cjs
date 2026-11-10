'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
const apps=require('../app/service/app-proxy'),tv=require('../app/service/network-tv'),network=require('../app/service/network');
assert.deepEqual(apps.preferences(),{enabled:false,mode:'direct',direct:[],vpn:[]});
for(const value of [{enabled:1},{mode:'all'},{vpn:['x;touch /tmp/unsafe']},{direct:[null]},{vpn:'youtube'}])assert.throws(()=>apps.preferences(value));
assert.deepEqual(apps.preferences({direct:['b','a','a'],vpn:['c']}),{enabled:false,mode:'direct',direct:['a','b'],vpn:['c']});
const hex=x=>Buffer.from(x).toString('hex'),row=(...x)=>x.map(hex).join('|');
const list=apps.parseRegistry([row('netflix','netflix.app','Нетфликс','Netflix'),row('same.pkg','same.ui','Один','One'),row('same.pkg','same.other','Два','Two'),row('severtvapp','severtvapp.app','TIZY','TIZY'),row('com.samsung.tv.cobalt','yt.app','','Youtube')].join('\n'));
assert.equal(list.length,3);assert.equal(list.find(x=>x.id==='same.pkg').shared,true);assert.equal(list.find(x=>x.id==='netflix').nameRu,'Нетфликс');assert.equal(list.find(x=>x.id==='com.samsung.tv.cobalt').name,'YouTube / YouTube Kids / YouTube TV');assert.throws(()=>apps.parseRegistry('bad|row'));
for(const mode of ['direct','vpn']){
 const config={enabled:true,mode,direct:['netflix'],vpn:['netflix']},script=tv.install(config);
 for(const command of ['iptables -t nat -A SEVER_TV_NAT','iptables -t filter -A SEVER_TV_OUT','ip6tables -t filter -A SEVER_TV_OUT']){
  const lines=script.split('\n').filter(l=>l.startsWith(command));
  assert.match(lines[0],new RegExp('--cgroup '+tv.classId+' -j RETURN$'),'Xray transport must always bypass the proxy');
  const guard=command+' -m cgroup '+(mode==='vpn'?'! ':'')+'--cgroup '+apps.classId+' -j RETURN';assert.equal(lines[command.includes('-t filter')?2:1],guard);if(command.includes('-t filter')){assert.ok(lines[1].includes('--dport '+(command.startsWith('ip6')?'19082':'19081')));assert.ok(lines[1].endsWith('-j REJECT --reject-with tcp-reset'),'Existing redirected connections of excluded apps must reset before the bypass guard');}
  assert.ok(lines.slice(2).some(l=>l.includes(command.includes('iptables -t filter')?'REJECT':'53')),'App guard must precede interception and blocking');
  // Evaluate the policy guard independently for the selected and unselected class.
  const bypass=classId=>mode==='direct'?classId===apps.classId:classId!==apps.classId;
  assert.equal(bypass(apps.classId),mode==='direct');assert.equal(bypass(0),mode==='vpn');
 }
 assert.equal(spawnSync('/bin/sh',['-n','-c',network.start('/tmp/tizy','/tmp/core','tv',config)]).status,0);
}
for(const mode of ['direct','vpn']){const empty={enabled:true,mode,direct:[],vpn:[]};assert.deepEqual(apps.guards('iptables -A TEST',empty),[]);assert.equal(apps.selective(empty),false);assert.equal(tv.install(empty),tv.install(),mode+' with no selection must use the global VPN policy');}
assert.ok(!tv.install().includes('--cgroup '+apps.classId));
assert.equal(apps.policyKey({enabled:true,mode:'vpn'}),apps.policyKey({enabled:false,mode:'direct',direct:['youtube']}));assert.notEqual(apps.policyKey({enabled:true,mode:'vpn',vpn:['youtube']}),apps.policyKey({enabled:true,mode:'direct',direct:['youtube']}));
assert.notEqual(apps.classId,tv.classId);assert.match(network.stop('/tmp/tizy','/tmp/core'),/tizy-default/);assert.match(network.start('/tmp/tizy','/tmp/core','tv',{enabled:true}),/tizy-apps/);
// Exercise attribution with existing sockets' owner processes, newly spawned
// children, changed labels, PID reuse, and foreign cgroups. No host /proc writes.
const processes=new Map(),moves=[],labelReads={};let inaccessible=false;let clock=100000;const originalNow=Date.now;Date.now=()=>clock;
function proc(id,label,group='/',start='100'){processes.set(String(id),{label,group,start,uid:process.getuid()});}
proc(100,'User::Pkg::youtube');proc(101,'User::Pkg::netflix');proc(102,'User::Pkg::severtvapp','/sever-xray');
const fake={
 readdirSync:()=>Array.from(processes.keys()),statSync:file=>({uid:processes.get(file.split('/')[2]).uid}),
 readFileSync(file){if(file===apps.group+'/cgroup.procs')return Array.from(processes).filter(([id,p])=>p.group==='/tizy-apps').map(([id])=>id).join('\n');const id=file.split('/')[2],p=processes.get(id);if(!p)throw Object.assign(Error('gone'),{code:'ENOENT'});if(file.endsWith('/attr/current')){labelReads[id]=(labelReads[id]||0)+1;return p.label;}if(file.endsWith('/stat'))return id+' (app with spaces) '+['S',...Array(18).fill('0'),p.start].join(' ');if(file.endsWith('/cgroup'))return '6:net_cls:'+p.group+'\n';throw Error('Unexpected read '+file);},
 writeFileSync(file,id){if(inaccessible)throw Object.assign(Error('denied'),{code:'EACCES'});assert.equal(file.endsWith('/cgroup.procs'),true);moves.push([id,file]);processes.get(id).group=file.startsWith(apps.group+'/')?'/tizy-apps':'/tizy-default';}
};
const monitor=new apps.Monitor({fs:fake,proc:'/proc'});
try{
 monitor.start({enabled:true,mode:'vpn',vpn:['youtube']});assert.equal(processes.get('100').group,'/tizy-apps');assert.equal(processes.get('101').group,'/');assert.equal(processes.get('102').group,'/sever-xray');
 const cachedReads=labelReads['101'];for(let i=0;i<10;i++)monitor.scan();assert.equal(labelReads['101'],cachedReads,'Stable unselected processes must not be reopened on every tick');clock+=1100;processes.get('101').label='User::Pkg::youtube';monitor.scan();assert.equal(processes.get('101').group,'/tizy-apps','Reused app-pool processes must be reclassified after the cache interval');processes.get('101').label='User::Pkg::netflix';monitor.scan();assert.equal(processes.get('101').group,'/tizy-default');
 proc(103,'User::Pkg::youtube','/tizy-apps');proc(104,'User::Pkg::netflix','/tizy-apps');monitor.scan();assert.equal(processes.get('103').group,'/tizy-apps');assert.equal(processes.get('104').group,'/tizy-default','A child with a different package label must not inherit the exclusion');
 processes.get('100').label='User::Pkg::netflix';monitor.scan();assert.equal(processes.get('100').group,'/tizy-default');
 proc(103,'User::Pkg::other','/foreign','999');const before=moves.length;monitor.scan();assert.equal(moves.length,before,'PID reuse must not move an unrelated process from a foreign group');
 proc(107,'System::Privileged');monitor.scan();clock+=1100;monitor.scan();const systemReads=labelReads['107'];for(let i=0;i<10;i++){clock+=100;monitor.scan();}assert.equal(labelReads['107'],systemReads,'Stable same-UID System processes must be cached, not polled at app-pool speed');proc(108,'System::Privileged');monitor.scan();processes.get('108').label='User::Pkg::youtube';clock+=101;monitor.scan();assert.equal(processes.get('108').group,'/tizy-apps','A new task must be rechecked quickly while it acquires a package label');
 proc(105,'User::Pkg::youtube','/foreign');assert.throws(()=>monitor.scan(),/отдельную сетевую группу/);processes.delete('105');
 proc(106,'User::Pkg::youtube');inaccessible=true;assert.throws(()=>monitor.scan(),/denied/);inaccessible=false;
}finally{monitor.stop();Date.now=originalNow;}
assert.equal(monitor.timer,null);
console.log('Per-app policy precedes DNS/UDP/IPv6 rules; package grouping, isolated selections, inherited tasks, PID reuse, foreign-group protection and cleanup: passed');
