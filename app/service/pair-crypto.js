'use strict';
var sodium=require('./vendor/libsodium-wrappers');
var DSI=new Buffer('CPace255-INCY-TVRELAY-v1');
function join(parts){return new Uint8Array(Buffer.concat(parts.map(function(p){return new Buffer(p);})));}
function encode(a){return new Buffer(a).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');}
function decode(a,n){if(typeof a!=='string'||!/^[A-Za-z0-9_-]+$/.test(a)||a.length>90000)throw new Error('Некорректные данные сопряжения');var b=new Uint8Array(new Buffer(a.replace(/-/g,'+').replace(/_/g,'/'),'base64'));if(n&&b.length!==n)throw new Error('Некорректный размер данных сопряжения');return b;}
function generator(code,sid){return sodium.crypto_core_ristretto255_from_hash(sodium.crypto_hash_sha512(join([DSI,new Buffer(code),sid])));}
function create(code,sid){sid=sid || sodium.randombytes_buf(16);var a=sodium.crypto_core_ristretto255_scalar_reduce(sodium.randombytes_buf(64));return {code:code,sid:sid,scalar:a,ya:sodium.crypto_scalarmult_ristretto255(a,generator(code,sid))};}
function key(session,yb){
    if(!sodium.crypto_core_ristretto255_is_valid_point(yb))throw new Error('Некорректная точка сопряжения');
    var shared=sodium.crypto_scalarmult_ristretto255(session.scalar,yb),ya=session.ya,lo=ya,hi=yb;
    if(Buffer.compare(new Buffer(ya),new Buffer(yb))>0){lo=yb;hi=ya;}
    var salt=new Uint8Array(32);salt.set(session.sid);
    var prk=sodium.crypto_auth_hmacsha256(join([shared,lo,hi]),salt);
    var result=sodium.crypto_auth_hmacsha256(join([DSI,new Uint8Array([1])]),prk);
    sodium.memzero(shared);sodium.memzero(prk);return result;
}
function decrypt(session,reply){
    var yb=decode(reply.yb,32),ct=decode(reply.ct);if(ct.length<28)throw new Error('Повреждённый шифротекст');
    var k=key(session,yb),plain;
    try{plain=sodium.crypto_aead_chacha20poly1305_ietf_decrypt(null,ct.subarray(12),null,ct.subarray(0,12),k);return JSON.parse(sodium.to_string(plain));}
    finally{sodium.memzero(k);if(plain)sodium.memzero(plain);}
}
function destroy(s){if(s&&s.scalar)sodium.memzero(s.scalar);}
module.exports={ready:sodium.ready,sodium:sodium,encode:encode,decode:decode,generator:generator,create:create,key:key,decrypt:decrypt,destroy:destroy};
