'use strict';
const assert=require('node:assert/strict'),i=require('../app/i18n'),fs=require('node:fs');
const english=new Set(Object.values(i.dictionary));
for(const lang of ['tr','zh-Hans']){
 assert.deepEqual(new Set(Object.keys(i.translations[lang])),english,'Every English message must have a '+lang+' translation');
 for(const [source,en] of Object.entries(i.dictionary)){
  const value=i.t(source,lang);assert.equal(value,i.translations[lang][en]);assert.ok(value.trim());
  assert.ok(!/[А-Яа-яЁё]/.test(value.replace(/Русский/g,'')),lang+': '+source);
  assert.deepEqual((value.match(/\{[a-z]+\}/g)||[]).sort(),(en.match(/\{[a-z]+\}/g)||[]).sort(),'Placeholders: '+en);
 }
 for(const text of ['Истекает через 1:32','94 мс','2.0 КБ/с','1.2 МБ/с','Ручное подключение: попытка 2 из 3','3 · в списке','Добавлено серверов: 4','Показано событий: 2 / 3','Релей отклонил код: HTTP 404','Через VPN · 2'])assert.ok(!/[А-Яа-яЁё]/.test(i.t(text,lang)),lang+': '+text);
 assert.ok(i.t('Истекает через 1:32',lang).includes('1:32'));assert.ok(i.t('Ручное подключение: попытка 2 из 3',lang).includes('2'));
 assert.equal(i.t('My personal server',lang),'My personal server','User names must not change');
}
assert.equal(i.t('Главная','tr'),'Ana sayfa');assert.equal(i.t('Главная','zh-Hans'),'首页');
assert.equal(i.t('94 мс','zh-Hans'),'94 毫秒');assert.equal(i.t('2.0 КБ/с','tr'),'2.0 KB/sn');
for(const code of ['tr','tr-TR','tur_TR'])assert.equal(i.language(code),'tr');
for(const code of ['zh','zh-CN','zh_SG','zh-Hans-CN','zho_CN','chi_CN'])assert.equal(i.language(code),'zh-Hans');
for(const code of ['zh-TW','zh-Hant','zh-HK','de-DE'])assert.equal(i.language(code),'en');
assert.equal(i.language('rus_RU'),'ru');assert.equal(i.language('eng_US'),'en');assert.ok(i.validPreference('tr')&&i.validPreference('zh-Hans'));assert.equal(i.validPreference('de'),false);
const html=fs.readFileSync(require('node:path').join(__dirname,'../app/index.html'),'utf8');assert.ok(!html.includes('Экспериментальная функция'));assert.ok(html.indexOf('src="i18n-locales.js"')<html.indexOf('src="i18n.js"'));
console.log('377 messages per language, placeholders, dynamic messages, TR/CN locale detection, unchanged server names and removed warning: passed');
