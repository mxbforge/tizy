const assert=require('assert/strict'),http=require('http'),fs=require('fs'),os=require('os'),path=require('path'),Client=require('../app/service/vetro-client');
const status=ready=>({mode:'tv-integration',app:{version:'0.5.0',shell:1},agent:{connected:ready,uid:ready?0:undefined}});
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tizy-discovery-'));
const serve=(port,handler)=>new Promise((resolve,reject)=>{const s=http.createServer(handler);s.on('error',reject);s.listen(port,'127.0.0.1',()=>resolve(s));});
const close=s=>new Promise(resolve=>s.close(resolve));
(async()=>{
 assert.ok(Client.identity(status(true)));assert.ok(!Client.identity({name:'Vetro',agent:{connected:true,uid:0}}));
 assert.deepEqual(Client.listeners('0: 00000000:FFFF 00000000:0000 0A\n1: 0100007F:2328 00000000:0000 01\n2: 00000000:FFFF 00000000:0000 0A'),[65535]);
 let seen=new Set(),active=0,peak=0;
 let c=new Client({defaults:[],hints:()=>[],probe:async p=>{assert.ok(!seen.has(p));seen.add(p);active++;peak=Math.max(peak,active);await new Promise(r=>setImmediate(r));active--;return null;}});
 await assert.rejects(c.find(),{code:'VETRO_NOT_FOUND'});assert.equal(seen.size,65535);assert.ok(seen.has(1)&&seen.has(65535));assert.ok(peak<=16);await assert.rejects(c.find(),{code:'VETRO_NOT_FOUND'});assert.equal(seen.size,65535);c.close();
 seen=new Set();c=new Client({defaults:[],hints:()=>[],probe:async p=>{seen.add(p);return p===65535?status(true):null;}});assert.equal((await c.find()).port,65535);assert.ok(seen.has(1));c.close();
 let posts=0,allMethods=[];
 const wrong=await serve(0,(req,res)=>{allMethods.push(req.method+' '+req.url);res.end(JSON.stringify({healthy:true,name:'Vetro'}));});
 const cache=path.join(dir,'port.json');fs.writeFileSync(cache,JSON.stringify({port:wrong.address().port}));
 let ready=false;
 const real=await serve(65535,(req,res)=>{if(req.method==='GET'&&req.url==='/status')return res.end(JSON.stringify(status(ready)));posts++;res.end(JSON.stringify({ok:true,output:'uid=0'}));});
 c=new Client({cacheFile:cache,defaults:[],hints:()=>[65535],min:65535,max:65535});
 await assert.rejects(c.execute('id -u'),{code:'VETRO_ROOT_PENDING'});assert.equal(posts,0);assert.equal(c.view.phase,'waiting-root');assert.ok(allMethods.every(x=>x==='GET /status'));
 ready=true;assert.equal(await c.execute('id -u'),'uid=0');assert.equal(posts,1);assert.equal(JSON.parse(fs.readFileSync(cache)).port,65535);assert.equal(fs.statSync(cache).mode&0o777,0o600);
 await close(real);
 const moved=await serve(0,(req,res)=>{if(req.url==='/status')return res.end(JSON.stringify(status(true)));posts++;res.end(JSON.stringify({ok:true,output:'moved'}));});c.hints=()=>[moved.address().port];assert.equal(await c.execute('id -u'),'moved');assert.equal(posts,2);assert.equal(c.view.port,moved.address().port);c.close();await close(moved);await close(wrong);
 // Redirects and invalid JSON never receive a command.
 for(const type of ['redirect','json','oversize']){
  let execs=0;const s=await serve(0,(req,res)=>{if(req.method!=='GET')execs++;if(type==='redirect'){res.writeHead(302,{Location:'http://example.invalid/'});res.end();}else res.end(type==='json'?'not json':'x'.repeat(262145));});
  c=new Client({defaults:[s.address().port],hints:()=>[],min:1,max:1});await assert.rejects(c.find(),{code:'VETRO_NOT_FOUND'});assert.equal(execs,0);c.close();await close(s);
 }
 let uncertainPosts=0;const uncertain=await serve(0,(req,res)=>{if(req.url==='/status')return res.end(JSON.stringify(status(true)));uncertainPosts++;req.resume();});
 c=new Client({defaults:[uncertain.address().port],hints:()=>[],min:1,max:1,execTimeout:60});await assert.rejects(c.execute('id -u'),{code:'VETRO_TIMEOUT'});assert.equal(uncertainPosts,1,'An uncertain command must never be replayed');c.close();await close(uncertain);
 let finish; c=new Client({defaults:[],hints:()=>[],max:1,probe:()=>new Promise(r=>finish=r)});const pending=c.find();await new Promise(r=>setImmediate(r));c.close();finish(null);await assert.rejects(pending,{code:'VETRO_CLOSED'});
 console.log('All 65535 ports, bounded concurrency, live port 65535, stale cache, unrelated services, root pending, failover, JSON limits, redirects, cancellation: passed');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>fs.rmSync(dir,{recursive:true,force:true}));
