(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.TizyLogging=factory();})(this,function(){'use strict';
var categories=['connection','network','servers','system'];
function defaults(){return {enabled:false,level:'all',details:true,categories:categories.slice()};}
function preferences(value){if(!value||typeof value!=='object'||Array.isArray(value)||(value.enabled!==undefined&&typeof value.enabled!=='boolean')||['all','warning','error'].indexOf(value.level)<0||typeof value.details!=='boolean'||!Array.isArray(value.categories)||value.categories.length>4||value.categories.some(function(c,i){return categories.indexOf(c)<0||value.categories.indexOf(c)!==i;}))throw new Error('Некорректные настройки журнала');return {enabled:value.enabled!==false,level:value.level,details:value.details,categories:value.categories.slice()};}
function visible(event,prefs){var category=event.category||'system',level=event.level||'info';return prefs.categories.indexOf(category)>=0&&(prefs.details||level!=='debug')&&(prefs.level==='all'||prefs.level==='warning'&&(level==='warning'||level==='error')||prefs.level==='error'&&level==='error');}
function message(text){text=String(text);var prefix='Соединение проверено: ',suffix=' · приложения ТВ · TCP IPv4 и DNS';return text.indexOf(prefix)===0&&text.slice(-suffix.length)===suffix?'VPN подключён к серверу: '+text.slice(prefix.length,-suffix.length):text;}
return {message:message,defaults:defaults,preferences:preferences,visible:visible,categories:categories};
});
