const assert=require('node:assert/strict'),t=require('../app/service/traffic');
const r=t.parse(JSON.stringify({stat:[{name:'outbound>>>proxy>>>traffic>>>uplink',value:'2048'},{name:'outbound>>>proxy>>>traffic>>>downlink',value:'1048576'},{name:'outbound>>>dns>>>traffic>>>uplink',value:'999'}]}));assert.deepEqual(r,{uploadBytes:2048,downloadBytes:1048576});
let a=t.sample(r,null,1000);assert.equal(a.uploadBps,null);let b=t.sample({uploadBytes:4096,downloadBytes:1048576+8192},a,3000);assert.equal(b.uploadBps,1024);assert.equal(b.downloadBps,4096);assert.equal(t.sample({uploadBytes:0,downloadBytes:0},b,4000).uploadBps,null);assert.throws(()=>t.parse('{"stat":[]}'));
console.log('Exact proxy-only counters, real elapsed-time rates, missing samples and reset handling: passed');
