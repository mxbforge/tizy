'use strict';
function scrub(text){return String(text==null?'':text).replace(/(?:vless|vmess|trojan|ss|https?):\/\/[^\s]+/gi,'[ссылка скрыта]').replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,'[ключ скрыт]').replace(/\b(password|uuid|token|secret|publicKey|privateKey|shortId|pbk|sid)(["']?\s*[:=]\s*["']?)[^\s,;}"']+/gi,'$1$2[ключ скрыт]').replace(/[\x00-\x08\x0b-\x1f\x7f]/g,'').slice(0,700);}
function EventLog(redact){this.items=[];this.next=1;this.enabled=true;this.redact=redact||function(s){return s;};}
EventLog.prototype.add=function(text,category,level,detail){if(!this.enabled)return null;var entry={id:this.next++,time:Date.now(),text:scrub(this.redact(String(text))),category:category||'connection',level:level||'info'};if(detail)entry.detail=scrub(this.redact(String(detail)));this.items.unshift(entry);if(this.items.length>300)this.items.length=300;return entry;};
EventLog.prototype.clear=function(){this.items.length=0;};
module.exports=EventLog;module.exports.scrub=scrub;
