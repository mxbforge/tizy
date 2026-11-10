'use strict';
const assert=require('node:assert/strict'),check=require('../app/service/tunnel-check');
(async()=>{
 let calls=0,retries=0;
 await check(()=>{if(++calls===1)throw Error('curl: (28) Operation timed out after 12000 milliseconds with 0 out of 0 bytes received');return '204';},{wait:()=>Promise.resolve(),retry:()=>retries++});assert.equal(calls,2);assert.equal(retries,1);
 calls=0;await assert.rejects(check(()=>{calls++;throw Error('curl: (28) Operation timed out');},{wait:()=>Promise.resolve()}),/timed out/);assert.equal(calls,2,'Persistent failures must stop after one retry');
 calls=0;await assert.rejects(check(()=>{calls++;throw Error('Permission denied');},{wait:()=>Promise.resolve()}),/Permission/);assert.equal(calls,1,'Permanent errors must fail immediately');
 calls=0;await check(()=>++calls===1?'503':'204',{wait:()=>Promise.resolve()});assert.equal(calls,2);
 console.log('Transient curl timeout and HTTP error recover once; persistent and permanent errors remain bounded: passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
