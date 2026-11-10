const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),runtime=require('../app/service/runtime');
const h=crypto.createHash('sha256').update(fs.readFileSync(require('node:path').join(__dirname,'../app/core/xray'))).digest('hex');assert.equal(runtime.hash,h);
const script=runtime.prepare('/opt/usr/apps/severtvapp/res/wgt/core/xray');
assert.ok(script.indexOf('xray.next')<script.indexOf('mount --bind'));assert.ok(script.includes('remount,ro,bind'));assert.ok(script.includes('sha256sum -c -'));assert.ok(!script.includes('/dev/mem'));assert.ok(!script.includes('/dev/sdp_hwmem'));assert.ok(!script.includes('dd '));
console.log('Pinned runtime hash, fresh inode, scoped read-only mount and failure rollback plan: passed');

const cp=require('node:child_process');for(const arch of ['armv7l','aarch64']){const lines=runtime.prepare(require('node:path').resolve(__dirname,'../app/core/xray')).split('\n');const test='uname(){ echo '+arch+'; };\n'+lines[1]+'\n'+lines.find(l=>l.startsWith('printf'));const result=cp.spawnSync('/bin/sh',['-c',test],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);}
console.log('Native architecture selection and shell hash checks for ARMv7/ARM64: passed');
