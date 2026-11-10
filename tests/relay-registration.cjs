const assert=require('node:assert/strict'),https=require('node:https'),{EventEmitter}=require('node:events');
const Pairing=require('../app/service/pairing');const original=https.request;let result=204;
https.request=function(options,callback){const req=new EventEmitter();req.setTimeout=()=>req;req.abort=()=>req.emit('error',new Error('aborted'));req.end=function(){if(!options.path.endsWith('/init'))return;process.nextTick(()=>{const res=new EventEmitter();res.statusCode=result;callback(res);if(result!==204)res.emit('data',Buffer.from('{"error":"access_denied"}'));res.emit('end');});};return req;};
(async()=>{const p=new Pairing(()=>Promise.resolve());try{
 const view=await p.start();assert.equal(view.mode,'relay');assert.match(view.code,/^[A-HJ-NP-Z2-9]{8}$/);assert.equal(view.qr,'incy://tv-pair/'+view.code);p.cancel();
 result=403;await assert.rejects(p.start(),/QR не создан/);assert.equal(p.view.phase,'error');assert.equal(p.view.code,undefined);assert.equal(p.view.qr,undefined);
 console.log('iPhone 8-character relay registration and no QR on server rejection: passed');
}finally{p.cancel();https.request=original;}})().catch(e=>{console.error(e);process.exitCode=1});
