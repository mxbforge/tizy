// Explicit live interoperability check: sends only a synthetic example.com payload.
const assert=require('node:assert/strict'),https=require('node:https'),crypto=require('node:crypto');
const c=require('../app/service/pair-crypto'),Pairing=require('../app/service/pairing'),relayDns=require('../app/service/relay-dns');
function request(method,path,body){return new Promise((resolve,reject)=>{const data=body?JSON.stringify(body):null,headers={'User-Agent':'SeverTV/0.2.1 (Samsung Tizen; ARMv7)'};if(data){headers['Content-Type']='application/json';headers['Content-Length']=Buffer.byteLength(data);}const r=https.request({hostname:'check.incytv.com',path,method,lookup:relayDns.lookup,headers},s=>{let text='';s.on('data',b=>text+=b);s.on('end',()=>resolve({status:s.statusCode,body:text?JSON.parse(text):null}));});r.on('error',reject);r.setTimeout(20000,()=>{r.destroy();reject(new Error('timeout'))});r.end(data);});}
(async()=>{
 let receiver,timeout;try{
  const payload={v:1,type:'subscription',url:'https://example.com/test',name:'Synthetic interoperability test'};
  let received;const complete=new Promise(r=>received=r);receiver=new Pairing(p=>{assert.deepEqual(p,payload);received();return Promise.resolve();});
  const view=await receiver.start();assert.match(view.qr,/^incy:\/\/tv-pair\/[A-HJ-NP-Z2-9]{8}$/);
  const offer=await request('GET','/pair/'+view.code);assert.equal(offer.status,200);
  const sid=c.decode(offer.body.sid),ya=c.decode(offer.body.ya),scalar=c.sodium.crypto_core_ristretto255_scalar_random();
  const yb=Buffer.from(c.sodium.crypto_scalarmult_ristretto255(scalar,c.generator(view.code,sid)));
  const shared=Buffer.from(c.sodium.crypto_scalarmult_ristretto255(scalar,ya)),[lo,hi]=[Buffer.from(ya),yb].sort(Buffer.compare);
  const key=Buffer.from(crypto.hkdfSync('sha256',Buffer.concat([shared,lo,hi]),sid,Buffer.from('CPace255-INCY-TVRELAY-v1'),32));
  const nonce=crypto.randomBytes(12),cipher=crypto.createCipheriv('chacha20-poly1305',key,nonce,{authTagLength:16});
  const ct=Buffer.concat([nonce,cipher.update(JSON.stringify(payload)),cipher.final(),cipher.getAuthTag()]);
  assert.equal((await request('POST','/pair/'+view.code+'/send',{yb:c.encode(yb),ct:c.encode(ct)})).status,204);
  await Promise.race([complete,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('No received payload')),15000)})]);
  console.log('Live official relay: init, independent sender, encrypted delivery and receiver decryption passed. Synthetic data only.');
 }finally{clearTimeout(timeout);if(receiver)receiver.cancel();}
})().catch(e=>{console.error(e);process.exitCode=1});
