'use strict';
var ports=require('./ports').values;
var q=require('./network').quote;
function command(core){return q(core)+' api statsquery --server=127.0.0.1:'+ports.stats+' -timeout 2 -pattern '+q('outbound>>>proxy>>>traffic>>>');}
function parse(text){var r=JSON.parse(text),out={uploadBytes:0,downloadBytes:0},found=0;(r.stat||[]).forEach(function(s){var v=Number(s.value||0);if(!isFinite(v)||v<0)return;if(s.name==='outbound>>>proxy>>>traffic>>>uplink'){out.uploadBytes=v;found++;}if(s.name==='outbound>>>proxy>>>traffic>>>downlink'){out.downloadBytes=v;found++;}});if(found!==2)throw new Error('Нет счётчиков Xray');return out;}
function sample(current,previous,now){var out={uploadBytes:current.uploadBytes,downloadBytes:current.downloadBytes,uploadBps:null,downloadBps:null,measuredAt:now};if(previous&&now>previous.measuredAt&&current.uploadBytes>=previous.uploadBytes&&current.downloadBytes>=previous.downloadBytes){var sec=(now-previous.measuredAt)/1000;out.uploadBps=(current.uploadBytes-previous.uploadBytes)/sec;out.downloadBps=(current.downloadBytes-previous.downloadBytes)/sec;}return out;}
module.exports={command:command,parse:parse,sample:sample};
