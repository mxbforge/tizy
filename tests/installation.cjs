const assert=require('assert/strict'),http=require('http'),fs=require('fs'),path=require('path'),os=require('os'),vm=require('vm'),installation=require('../app/service/installation');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tizy-install-'));
(async()=>{
 const a=installation.token(dir);assert.match(a,/^[a-f0-9]{64}$/);assert.equal(installation.token(dir),a);assert.equal(fs.statSync(path.join(dir,'local-key.json')).mode&0o777,0o600);
 const dir2=path.join(dir,'other');fs.mkdirSync(dir2);assert.notEqual(installation.token(dir2),a);
 const occupied=http.createServer();await new Promise(r=>occupied.listen(19090,'127.0.0.1',r));const own=http.createServer();const port=await installation.listen(own,dir,a);assert.equal(port,19100);const endpoint=JSON.parse(fs.readFileSync(path.join(dir,'tizy-endpoint.json')));assert.equal(endpoint.port,port);assert.equal(endpoint.token,a);assert.equal(fs.statSync(path.join(dir,'tizy-endpoint.json')).mode&0o777,0o600);
 const context={window:{TIZY_DISTRIBUTABLE:true},tizen:{filesystem:{resolve:(name,cb)=>{assert.equal(name,'wgt-private/tizy-endpoint.json');cb({readAsText:done=>done(JSON.stringify(endpoint))});}}}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../app/bootstrap.js'),'utf8'),context);let value;context.window.TizyBootstrap.read((err,s)=>{assert.ifError(err);value=s;});assert.equal(value.port,19100);assert.equal(value.token,a);assert.ok(!context.window.TizyBootstrap.valid({...endpoint,port:65535}));assert.ok(!context.window.TizyBootstrap.valid({...endpoint,token:'shared'}));
 await new Promise(r=>own.close(r));await new Promise(r=>occupied.close(r));
 console.log('Per-install unique key, stable restart, occupied API port, private bootstrap, frontend token/port validation: passed');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>fs.rmSync(dir,{recursive:true,force:true}));
