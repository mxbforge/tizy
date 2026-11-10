const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawn}=require('node:child_process');
const app=path.resolve(__dirname,'../app'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'sever-test-'));let child,token;const calls=[];
const mock=http.createServer((req,res)=>{let b='';req.on('data',x=>b+=x);req.on('end',()=>{if(req.method==='GET'&&req.url==='/status'){res.setHeader('content-type','application/json');res.end(JSON.stringify({mode:'tv-integration',app:{version:'0.5.0',shell:1},agent:{connected:true,uid:0}}));return;}const wrapped=JSON.parse(b).cmd;assert.match(wrapped,/^printf %s [A-Za-z0-9+/=]+ \| base64 -d \| \/bin\/sh$/);const cmd=Buffer.from(wrapped.split(' ')[2],'base64').toString('utf8');calls.push(cmd);res.setHeader('content-type','application/json');res.end(JSON.stringify(cmd.endsWith(' version')?{ok:false,stderr:'Operation not permitted'}:{ok:true,output:''}));});});
function api(route,body,key=token){return new Promise((resolve,reject)=>{const data=body?JSON.stringify(body):null;const r=http.request({hostname:'127.0.0.1',port:19090,path:route,method:data?'POST':'GET',headers:{'X-Sever-Token':key,'Content-Type':'application/json'}},s=>{let b='';s.on('data',x=>b+=x);s.on('end',()=>resolve({code:s.statusCode,body:JSON.parse(b)}));});r.on('error',reject);r.end(data);});}
(async()=>{
 await new Promise(r=>mock.listen(9000,'127.0.0.1',r));
 child=spawn(process.execPath,[path.join(app,'service/main.js')],{env:{...process.env,SEVER_DATA:dir},stdio:['ignore','ignore','pipe']});let stderr='';child.stderr.on('data',x=>stderr+=x);
 let state;for(let i=0;i<50;i++){await new Promise(r=>setTimeout(r,100));try{token=JSON.parse(fs.readFileSync(path.join(dir,'local-key.json'))).token;state=await api('/state');break;}catch{}}assert.ok(state,stderr);
 assert.equal((await api('/state',null,'wrong')).code,403);
 assert.equal(state.body.name,'TIZY');assert.equal(state.body.mode,'tv');assert.equal(state.body.settings.language,'auto');assert.equal(state.body.settings.autoConnect,false);assert.equal(state.body.settings.ipFamily,'auto');
 assert.equal(state.body.settings.log.enabled,false);assert.deepEqual(state.body.events,[]);await api('/settings',{log:{...require('../app/logging').defaults(),enabled:true}});
 let setting=await api('/settings',{language:'en',autoConnect:true,ipFamily:'ipv6'});assert.equal(setting.code,200);assert.equal(setting.body.settings.language,'en');assert.equal(setting.body.settings.autoConnect,true);assert.equal((await api('/settings',{language:'de'})).code,400);assert.equal((await api('/settings',{autoConnect:'true'})).code,400);
 const persisted=JSON.parse(fs.readFileSync(path.join(dir,'profiles.json'),'utf8'));assert.deepEqual(persisted.settings,{language:'en',autoConnect:true,ipFamily:'ipv6',log:{...require('../app/logging').defaults(),enabled:true},appProxy:require('../app/service/app-proxy').preferences()});assert.equal((await api('/settings',{ipFamily:'ipv5'})).code,400);assert.equal((await api('/settings',{ipFamily:null})).code,400);await api('/settings',{language:'auto',autoConnect:false,ipFamily:'auto'});

 for(const language of ['tr','zh-Hans']){const response=await api('/settings',{language});assert.equal(response.code,200);assert.equal(response.body.settings.language,language);assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'profiles.json'),'utf8')).settings.language,language);}await api('/settings',{language:'auto'});
 const link='vless://11111111-2222-4333-8444-555555555555@example.com:443?security=reality&pbk=abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ&sni=example.org#Test';
 let r=await api('/import',{text:link});assert.equal(r.code,200);assert.equal(r.body.servers.length,1);assert.ok(!JSON.stringify(r.body).includes('11111111'));
 const firstSelected=r.body.selected;
 const duplicates=await api('/import',{text:link+'\n'+link});
 assert.deepEqual(duplicates.body.servers.map(p=>p.name),['Test','Test (1)','Test (2)']);
 assert.equal(new Set(duplicates.body.servers.map(p=>p.id)).size,3);
 assert.equal(duplicates.body.selected,firstSelected);
 for(const p of duplicates.body.servers.slice(1))await api('/delete',{id:p.id});
 await api('/pair/local',{});
 const incyPayload={servers:[{name:'Test',url:link},{name:'Test',url:link}]};
 await new Promise((resolve,reject)=>{let out='';const socket=require('node:net').connect(19091,'127.0.0.1',()=>socket.write('CONFIG '+JSON.stringify(incyPayload)+'\n'));socket.on('data',b=>out+=b);socket.on('error',reject);socket.on('end',()=>{try{assert.equal(out.trim(),'OK');resolve();}catch(e){reject(e);}});});
 const incy=await api('/pair/accept',{});
 assert.deepEqual(incy.body.servers.map(p=>p.name),['Test','Test (1)','Test (2)']);
 assert.equal(incy.body.selected,firstSelected);
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir,'profiles.json'),'utf8')).servers.map(p=>p.name),['Test','Test (1)','Test (2)']);
 for(const p of incy.body.servers.slice(1))await api('/delete',{id:p.id});
 await api('/pair/cancel',{});
 assert.equal(fs.statSync(path.join(dir,'profiles.json')).mode&0o777,0o600);
 assert.equal((await api('/import',{text:'https://127.0.0.1/private'})).code,400);
 const beforeHapp=r.body.servers.length;
 let hv=await api('/pair/start',{protocol:'happ'});assert.equal(hv.code,200);assert.equal(hv.body.pairing.mode,'happ-local');const receiver=JSON.parse(Buffer.from(hv.body.pairing.qr.split('/').pop(),'base64'));
 await new Promise((resolve,reject)=>{const socket=require('node:net').connect(receiver.port,receiver.ip,()=>socket.end(link.replace('#Test','#Happ-test')+'\n'+link.replace('#Test','#Happ-test-2')+'\n'));socket.on('error',reject);socket.on('close',resolve);});
 for(let i=0;i<40;i++){await new Promise(resolve=>setTimeout(resolve,10));hv=await api('/state');if(hv.body.pairing.phase==='received')break;}
 assert.equal(hv.body.pairing.phase,'received');assert.equal(hv.body.servers.length,beforeHapp+2);assert.equal(hv.body.selected,r.body.selected);assert.equal(JSON.stringify(hv.body.pairing).includes('11111111'),false);assert.equal((await api('/pair/accept',{})).code,400);
 assert.equal((await api('/pair/start',{protocol:'unknown'})).code,400);const retained=await api('/pair/start',{});assert.equal(retained.body.pairing.mode,'happ-local','A legacy refresh must keep the chosen QR format');await api('/pair/cancel',{});assert.equal((await api('/state')).body.pairing.phase,'idle');
 const count=calls.length;r=await api('/connect',{id:r.body.selected,mode:'tv'});assert.equal(r.code,400);assert.ok(r.body.error.includes('Tizen'));
 assert.ok(!calls.slice(count).some(x=>x.includes('-I OUTPUT')),'Blocked core must not install a redirect');
 r=await api('/state');assert.equal(r.body.phase,'error');assert.equal(r.body.ready,false);
 await api('/disconnect',{});assert.equal((await api('/state')).body.phase,'disconnected');
 const listener=require('node:net').createServer(s=>s.end());await new Promise(r=>listener.listen(0,'127.0.0.1',r));
 try{
  const probeLink='vless://11111111-2222-4333-8444-555555555555@127.0.0.1:'+listener.address().port+'?security=reality&pbk=test#Offline';
  r=await api('/import',{text:probeLink});const id=r.body.servers[r.body.servers.length-1].id;await api('/select',{id});await api('/settings',{ipFamily:'ipv6'});const noFamily=await api('/measure',{});assert.equal(noFamily.code,400);assert.match(noFamily.body.error,/IPv6/);const invalidConnect=await api('/connect',{id});assert.equal(invalidConnect.code,400);assert.equal((await api('/state')).body.phase,'disconnected');await api('/settings',{ipFamily:'ipv4'});
  const before=calls.length;r=await api('/measure',{});assert.equal(r.code,200);assert.equal(r.body.phase,'disconnected');assert.equal(r.body.selectedProbe.profileId,id);assert.equal(r.body.selectedProbe.serverIP,'127.0.0.1');assert.equal(r.body.selectedProbe.latencyKind,'TCP');assert.equal(r.body.selectedProbe.reachable,true);assert.equal(calls.length,before,'Offline ping must not run the core or root commands');
  await api('/settings',{ipFamily:'auto'});assert.deepEqual((await api('/state')).body.selectedProbe,{});await api('/select',{id:r.body.servers[0].id});assert.deepEqual((await api('/state')).body.selectedProbe,{});
  const first=r.body.servers[0].id;const added=await api('/import',{text:probeLink.replace('127.0.0.1','127.0.0.2').replace('#Offline','#Unreachable')});
  const last=added.body.servers[added.body.servers.length-1].id;await api('/select',{id:first});const sweepCalls=calls.length;
  r=await api('/measure/all',{});assert.equal(r.code,200);let snapshot;
  for(let i=0;i<100;i++){snapshot=(await api('/state')).body;if(!snapshot.pingSweep.running)break;await new Promise(r=>setTimeout(r,50));}
  assert.equal(snapshot.pingSweep.running,false);assert.equal(snapshot.pingSweep.completed,snapshot.servers.length);assert.equal(snapshot.selected,first);assert.equal(snapshot.phase,'disconnected');assert.equal(snapshot.serverPings[id].reachable,true);assert.equal(snapshot.serverPings[last].reachable,false);assert.equal(snapshot.serverPings[last].latencyMs,null);assert.equal(calls.length,sweepCalls,'Batch ping must not start root or VPN while disconnected');

 }finally{await new Promise(r=>listener.close(r));}
 const filters={enabled:true,level:'warning',details:false,categories:['network','connection']};assert.equal((await api('/settings',{log:filters})).code,200);assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir,'profiles.json'),'utf8')).settings.log,filters);assert.equal((await api('/settings',{log:{...filters,level:'invalid'},language:'en'})).code,400);assert.equal((await api('/state')).body.settings.language,'auto');assert.equal((await api('/settings',{log:{...filters,categories:['passwords']}})).code,400);const logs=(await api('/state')).body.events;assert.ok(logs.some(e=>e.category==='network'));assert.ok(logs.some(e=>e.level==='debug'));assert.ok(logs.some(e=>e.level==='error'));assert.ok(!JSON.stringify(logs).includes('11111111-2222-4333-8444-555555555555'));assert.equal((await api('/logs/clear',{})).body.events.length,0);
 const stopped=await api('/settings',{log:{...filters,enabled:false}});assert.equal(stopped.body.settings.log.enabled,false);const savedCount=stopped.body.events.length;await api('/settings',{language:'en'});await api('/settings',{ipFamily:'ipv4'});await api('/settings',{ipFamily:'ipv5'});assert.equal((await api('/state')).body.events.length,savedCount);assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'profiles.json'),'utf8')).settings.log.enabled,false);
 child.kill('SIGTERM');await new Promise(r=>child.once('exit',r));child=spawn(process.execPath,[path.join(app,'service/main.js')],{env:{...process.env,SEVER_DATA:dir},stdio:'ignore'});let restarted;for(let i=0;i<50;i++){await new Promise(r=>setTimeout(r,100));try{restarted=await api('/state');break;}catch{}}assert.ok(restarted);assert.equal(restarted.body.settings.log.enabled,false);assert.equal(restarted.body.events.length,0);await api('/settings',{log:{...filters,enabled:true},language:'auto',ipFamily:'auto'});assert.ok((await api('/state')).body.events.some(e=>e.text==='Запись журнала включена'));assert.equal((await api('/logs/export',{scope:'invalid',language:'ru'})).code,400);assert.equal((await api('/logs/export/close',{})).body.logExport.phase,'idle');
 assert.equal((await api('/pair/cancel',{})).body.pairing.phase,'idle');
 console.log('Loopback auth, local secret storage, redacted state, subscription SSRF guard, blocked-core rollback and pairing cancel: passed');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(child){child.kill('SIGTERM');await new Promise(r=>child.once('exit',r));}mock.close();fs.rmSync(dir,{recursive:true,force:true});});
