const assert=require('node:assert/strict'),WebSocket=require('../deps/node_modules/ws'),Pairing=require('../app/service/v2raytun-pairing');
const sample='vless://00000000-0000-4000-8000-000000000001@example.invalid:443?security=tls#V2-test';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let i=0;i<100;i++){if(fn())return;await delay(5);}throw Error('Test timeout');}
(async()=>{const server=new WebSocket.Server({host:'127.0.0.1',port:0});await new Promise(r=>server.once('listening',r));let mode='ok',socket,requests=[];
server.on('connection',ws=>{socket=ws;ws.on('message',data=>{let m=JSON.parse(data);requests.push(m);if(m.action==='SUBSCRIBE'&&mode!=='delay')ws.send(JSON.stringify(mode==='reject'?{status:'ERROR',message:'sensitive-server-message'}:{status:'SUCCESS'}));if(m.action==='UNSUBSCRIBE')ws.send(JSON.stringify({status:'ERROR',message:'Already unsubscribed'}));});});
const options={endpoint:'ws://127.0.0.1:'+server.address().port,lifetime:2000,timeout:500};let imports=[];
const p=new Pairing(async(payload,valid)=>{if(valid())imports.push(payload);},options);
try{
 let view=await p.start();assert.match(view.qr,/^[a-f0-9]{12}4[a-f0-9]{3}[89ab][a-f0-9]{15}$/);assert.equal(view.mode,'v2raytun-relay');const key=view.qr;
 socket.send(JSON.stringify({status:'UPDATE',key:'other',value:sample}));await delay(20);assert.equal(imports.length,0);assert.equal(p.view.phase,'waiting');
 socket.send(JSON.stringify({status:'UPDATE',key,value:sample}));await until(()=>p.view.phase==='received');assert.equal(imports[0].text,sample);assert.equal(p.view.qr,undefined);await until(()=>requests.some(m=>m.action==='REMOVE'&&m.key===key));await delay(30);assert.equal(p.view.phase,'received','Cleanup replies must not turn a completed import into an error');
 mode='delay';const pending=p.start();await until(()=>requests.filter(m=>m.action==='SUBSCRIBE').length===2);assert.equal(p.view.qr,undefined);p.cancel();await assert.rejects(pending,/отменена/);assert.equal(p.view.phase,'idle');
 mode='reject';await assert.rejects(p.start(),/отклонил/);assert.equal(p.view.qr,undefined);assert.ok(!JSON.stringify(p.view).includes('sensitive'));
 mode='ok';view=await p.start();socket.send(JSON.stringify({status:'UPDATE',key:view.qr,value:'v2raytun://crypt/hidden'}));await until(()=>p.view.phase==='error');assert.match(p.view.error,/Зашифрованные/);assert.ok(!JSON.stringify(p.view).includes('hidden'));
 const exp=new Pairing(async()=>{}, {...options,lifetime:30});await exp.start();await until(()=>exp.view.phase==='expired');assert.equal(exp.key,null);exp.cancel();
 let finish;const slow=new Pairing((payload,valid)=>new Promise(resolve=>{finish=()=>{if(valid())imports.push(payload);resolve();};}),options);view=await slow.start();socket.send(JSON.stringify({status:'UPDATE',key:view.qr,value:sample}));await until(()=>!!finish);slow.cancel(undefined,true);assert.equal(slow.view.phase,'importing');finish();await slow.completed;assert.equal(slow.view.phase,'received');slow.cancel();
 assert.equal(Pairing.decode('v2raytun://import/'+sample).text,sample);assert.equal(Pairing.decode('https://example.invalid/sub').text,'https://example.invalid/sub');assert.throws(()=>Pairing.decode(null));assert.throws(()=>Pairing.decode('not a config'));assert.throws(()=>Pairing.decode('x'.repeat(524289)));
 const config={remarks:'JSON test',inbounds:[{protocol:'socks',port:12345}],outbounds:[{protocol:'vless',settings:{vnext:[{address:'example.invalid',port:443,users:[{id:'00000000-0000-4000-8000-000000000001'}]}]},streamSettings:{network:'tcp',security:'tls',tlsSettings:{serverName:'example.invalid'}}}]};const parsed=Pairing.decode(JSON.stringify(config));assert.equal(parsed.profiles.length,1);assert.equal(parsed.profiles[0].host,'example.invalid');assert.equal(parsed.profiles[0].inbounds,undefined);
 console.log('v2RayTun subscription-before-QR, own key binding, URI/JSON import, relay cleanup, cancellation, errors, expiry and back during import: passed');
}finally{p.cancel();server.clients.forEach(ws=>ws.terminate());await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
