const assert=require('node:assert/strict'),crypto=require('node:crypto');
const c=require('../app/service/pair-crypto');
(async()=>{
 await c.ready;
 const sid=Uint8Array.from(Array.from({length:16},(_,i)=>i));
 assert.equal(Buffer.from(c.generator('TESTCODE',sid)).toString('hex'),'def51453cb5cfdb7d78e667cf7575060841474e063f5e39ea28f14fd9340042f');
 const receiver=c.create('TESTCODE',sid);
 // Independent sender follows the official Node example, using Node HKDF and AEAD.
 const scalar=c.sodium.crypto_core_ristretto255_scalar_random();
 const yb=Buffer.from(c.sodium.crypto_scalarmult_ristretto255(scalar,c.generator('TESTCODE',sid)));
 const shared=Buffer.from(c.sodium.crypto_scalarmult_ristretto255(scalar,receiver.ya));
 const [lo,hi]=[Buffer.from(receiver.ya),yb].sort(Buffer.compare);
 const key=Buffer.from(crypto.hkdfSync('sha256',Buffer.concat([shared,lo,hi]),sid,Buffer.from('CPace255-INCY-TVRELAY-v1'),32));
 assert.deepEqual(Buffer.from(c.key(receiver,yb)),key);
 const payload={v:1,type:'subscription',url:'https://example.com/test',name:'Тест'};
 const nonce=crypto.randomBytes(12),cipher=crypto.createCipheriv('chacha20-poly1305',key,nonce,{authTagLength:16});
 const ct=Buffer.concat([nonce,cipher.update(JSON.stringify(payload)),cipher.final(),cipher.getAuthTag()]);
 assert.deepEqual(c.decrypt(receiver,{yb:c.encode(yb),ct:c.encode(ct)}),payload);
 const damaged=Buffer.from(ct);damaged[20]^=1;
 assert.throws(()=>c.decrypt(receiver,{yb:c.encode(yb),ct:c.encode(damaged)}));
 assert.throws(()=>c.decrypt(receiver,{yb:c.encode(Buffer.alloc(32)),ct:c.encode(ct)}));
 c.destroy(receiver);assert.ok(receiver.scalar.every(b=>b===0));
 console.log('Official CPace vector, independent HKDF/AEAD sender, UTF-8, invalid MAC/point rejection and scalar wipe: passed');
})().catch(e=>{console.error(e);process.exitCode=1});
