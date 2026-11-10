'use strict';
// The local DNS resolver returned a different address for the relay. Resolve only
// this public hostname through authenticated DoH; subscription URLs are not sent.
var https=require('https'),publicIP=require('./addresses').publicIP;
var cached=null,expires=0,pending=null;
function query(type){return new Promise(function(resolve,reject){
    var req=https.get({hostname:'dns.google',path:'/resolve?name=check.incytv.com&type='+type,headers:{Accept:'application/dns-json'}},function(res){
        var text='';res.on('data',function(b){text+=b;if(text.length>65536){req.abort();reject(new Error('DNS response too large'));}});
        res.on('end',function(){try{if(res.statusCode!==200)throw new Error('DNS HTTP error');var data=JSON.parse(text);if(data.Status!==0)throw new Error('DNS error');resolve((data.Answer || []).filter(function(a){return a.type===(type==='AAAA'?28:1)&&publicIP(a.data);}).map(function(a){return {address:a.data,family:type==='AAAA'?6:4,ttl:Number(a.TTL)||30};}));}catch(e){reject(e);}});
    });req.on('error',reject);req.setTimeout(8000,function(){req.abort();reject(new Error('DNS timeout'));});
});}
function resolve(){if(cached && Date.now()<expires)return Promise.resolve(cached);if(pending)return pending;
    pending=Promise.all([query('A').catch(function(){return [];}),query('AAAA').catch(function(){return [];})]).then(function(parts){
        var records=parts[0].concat(parts[1]);if(!records.length)throw new Error('Не удалось получить публичный адрес релея Incy');
        cached=records;expires=Date.now()+Math.max(1,Math.min.apply(null,records.map(function(a){return Math.min(300,a.ttl);}))) * 1000;pending=null;return records;
    },function(e){pending=null;throw e;});
    pending=pending.then(function(r){return r;},function(e){pending=null;throw e;});return pending;
}
function lookup(host,options,callback){if(host!=='check.incytv.com'){callback(new Error('Unexpected relay hostname'));return;}
    resolve().then(function(records){var list=records.filter(function(r){return !options.family || Number(options.family)===r.family;});if(!list.length){callback(new Error('Relay address family unavailable'));return;}
        if(options.all)callback(null,list.map(function(r){return {address:r.address,family:r.family};}));else callback(null,list[0].address,list[0].family);
    },callback);
}
module.exports={lookup:lookup,resolve:resolve};
