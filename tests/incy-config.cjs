const assert=require('node:assert/strict'),p=require('../app/service/profiles');
const original=p.parse('vless://11111111-2222-4333-8444-555555555555@example.com:443?security=reality&pbk=abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ&sni=example.org&flow=xtls-rprx-vision#Reality');
const outbound=p.config(original).outbounds[0];
for(const input of [outbound,JSON.stringify(outbound),{outbounds:[{protocol:'freedom'},outbound]},{config:{outbounds:[outbound]}},{configuration:JSON.stringify({outbounds:[outbound]})}]){
 const profile=p.fromIncy(input);assert.equal(profile.protocol,'vless');assert.equal(profile.secret,original.secret);assert.equal(profile.publicKey,original.publicKey);assert.equal(profile.flow,'xtls-rprx-vision');
}
assert.equal(p.fromIncy({type:'vless',address:'example.com',port:443,uuid:original.secret,security:'reality',publicKey:original.publicKey}).protocol,'vless');
assert.equal(p.fromIncy({url:'vless://'+original.secret+'@example.com:443?security=reality&pbk='+original.publicKey}).publicKey,original.publicKey);
const iphone={isActive:true,address:'example.com',uuid:original.secret,encryption:'none',path:'/test',network:'xhttp',allowInsecure:false,sni:'example.org',spiderX:'/probe',createdAt:1,fingerprint:'chrome',security:'reality',publicKey:original.publicKey,proxyProtocol:'VLESS',port:443,xhttpExtra:'{"noGRPCHeader":true}',xhttpMode:'packet-up',shortId:'abcd',name:'iPhone Reality',host:'example.org',id:'fixture'};
const converted=p.fromIncy(iphone),cfg=p.config(converted).outbounds[0];assert.equal(converted.protocol,'vless');assert.equal(converted.secret,original.secret);assert.equal(cfg.streamSettings.realitySettings.spiderX,'/probe');assert.equal(cfg.streamSettings.xhttpSettings.mode,'packet-up');assert.equal(cfg.streamSettings.xhttpSettings.extra.noGRPCHeader,true);
assert.equal(p.fromIncy({...iphone,network:'splithttp',xhttpExtra:encodeURIComponent(iphone.xhttpExtra)}).network,'xhttp');
assert.throws(()=>p.fromIncy({outbounds:[{protocol:'freedom'}]}));
assert.throws(()=>p.fromIncy({config:{config:{config:{config:{config:{protocol:'vless'}}}}}}));
console.log('Incy model aliases, URI entries, JSON-encoded Xray/outbound configurations, Reality and Vision preservation: passed');
