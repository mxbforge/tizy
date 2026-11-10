const assert=require('node:assert/strict'),net=require('node:net'),Local=require('../app/service/local-pairing'),profiles=require('../app/service/profiles');
function send(s,host='127.0.0.1'){return new Promise((resolve,reject)=>{let out='';const c=net.connect(19091,host,()=>c.write(s+'\n'));c.on('data',b=>out+=b);c.on('end',()=>resolve(out.trim()));c.on('error',reject);});}
(async()=>{
 let received=null;const p=new Local(payload=>{received=payload;return Promise.resolve();});
 try{
  const view=await p.start();assert.match(view.code,/^[A-HJ-NP-Z2-9]{6}$/);assert.equal(JSON.parse(view.qr).type,'incy_pairing');assert.deepEqual(view.families,['IPv4','IPv6']);
  assert.match(await send('XXXXXX|{}'),/^ERROR/);assert.equal(received,null);
  const sample={version:2,type:'incy_subscription',subscription:{url:'https://example.com/test',name:'Провайдер'}};
  assert.equal(await send(view.code+'|'+JSON.stringify(sample),'::1'),'OK');assert.equal(p.view.phase,'confirm');assert.equal(received,null);
  await p.accept();assert.equal(received.url,sample.subscription.url);assert.equal(p.view.phase,'received');
  received=null;await p.start();const server={name:'Сервер Reality',address:'example.com',port:443,protocol:'vless',uuid:'11111111-2222-4333-8444-555555555555',network:'tcp',security:'reality',sni:'example.org',publicKey:'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ',shortId:'abcd',fingerprint:'chrome'};
  assert.equal(await send('CONFIG '+JSON.stringify({version:2,servers:[server]})),'OK');assert.equal(received,null,'Legacy CONFIG must wait for physical confirmation');
  await p.accept();const converted=profiles.fromIncy(received.servers[0]);assert.equal(converted.secret,server.uuid);assert.equal(converted.publicKey,server.publicKey);assert.equal(converted.name,server.name);
  await p.start();for(let i=0;i<5;i++)await send('WRONGX|{}');assert.equal(p.view.phase,'error');
  console.log('Local Incy 6-character QR, subscription/config wire formats, mandatory TV confirmation, Reality conversion and attempt limit: passed');
 }finally{p.cancel();}
})().catch(e=>{console.error(e);process.exitCode=1});
