const assert=require('assert/strict'),apps=require('../app/service/app-proxy'),labels=require('../app/service/app-labels');
const row=(pkg,id,en,ru='')=>[pkg,id,ru,en].map(s=>Buffer.from(s).toString('hex')).join('|');
const result=apps.parseRegistry([
 row('org.tizen.browser','org.tizen.browser','Internet'),
 row('com.samsung.tv.knox-browser','com.samsung.tv.knox-browser','Internet'),
 row('com.samsung.tv.store','com.samsung.tv.store','Apps'),row('com.samsung.tv.store','org.volt.apps','Apps'),
 row('custom.browser','custom.browser.app','Internet'),row('custom.app','custom.app.ui','My own label','Моя подпись')
].join('\n'));
const browser=result.find(x=>x.id==='org.tizen.browser'),knox=result.find(x=>x.id==='com.samsung.tv.knox-browser');
assert.equal(browser.nameRu,'Браузер Samsung');assert.equal(knox.nameRu,'Браузер Samsung Knox');assert.equal(browser.name,'Samsung Browser');assert.equal(knox.name,'Samsung Knox Browser');assert.notEqual(browser.id,knox.id);assert.deepEqual(browser.appIds,['org.tizen.browser']);assert.equal(result.find(x=>x.id==='com.samsung.tv.store').appIds.length,2);
assert.equal(result.find(x=>x.id==='custom.browser').name,'Internet');assert.equal(result.find(x=>x.id==='custom.app').nameRu,'Моя подпись');
for(const [id,names] of Object.entries(labels.names)){assert.equal(names.length,4);assert.ok(names.every(s=>s.trim()));const item=labels.apply({id,appIds:[id],shared:false});assert.equal(item.id,id);assert.deepEqual(item.appIds,[id]);assert.equal(item.labels.tr,names[2]);assert.equal(item.labels['zh-Hans'],names[3]);}
console.log('Known system labels in four languages, separate Browser/Knox routes, shared packages and unknown custom labels preserved: passed');
