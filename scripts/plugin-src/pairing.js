'use strict';
var https=require('https'),crypto=require('./pair-crypto');
var relayDns=require('./relay-dns');
var ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function Pairing(onReceive){this.receive=onReceive;this.session=null;this.req=null;this.view={phase:'idle'};this.timer=null;}
Pairing.prototype.cancel=function(){var old=this.session;this.session=null;if(this.timer)clearTimeout(this.timer);this.timer=null;relayDns.cancel();if(this.req){this.req.abort();this.req=null;}crypto.destroy(old);this.view={phase:'idle'};};
Pairing.prototype.request=function(method,path,body,session){var self=this;return new Promise(function(resolve,reject){
    var data=body?JSON.stringify(body):null,headers={'User-Agent':'TIZY/0.11.1 (Samsung Tizen; ARMv7)'};
    if(data){headers['Content-Type']='application/json';headers['Content-Length']=Buffer.byteLength(data);}
    var req=https.request({hostname:'check.incytv.com',port:443,path:path,method:method,lookup:relayDns.lookup,headers:headers},function(res){res.on('error',function(){if(self.req===req)self.req=null;reject(new Error('Соединение с релеем Incy прервано'));});res.on('aborted',function(){if(self.req===req)self.req=null;reject(new Error('Ответ релея Incy прерван'));});var s='';res.on('data',function(b){s+=b;if(s.length>90000){req.abort();reject(new Error('Ответ релея слишком большой'));}});res.on('end',function(){if(self.req===req)self.req=null;if(session!==self.session)return reject(new Error('Сопряжение отменено'));try{resolve({status:res.statusCode,body:s?JSON.parse(s):null});}catch(e){reject(new Error('Некорректный ответ релея'));}});});
    self.req=req;req.on('error',function(){if(self.req===req)self.req=null;reject(new Error('Релей Incy недоступен'));});req.setTimeout(35000,function(){req.abort();reject(new Error('Релей не ответил'));});req.end(data);
});};
Pairing.prototype.start=function(){var self=this;self.cancel();self.view={phase:'starting',mode:'relay'};return crypto.ready.then(function(){
    var bytes=crypto.sodium.randombytes_buf(8),code='';for(var i=0;i<8;i++)code+=ALPHABET[bytes[i]&31];
    var s=crypto.create(code);self.session=s;return self.request('POST','/pair/init',{code:code,sid:crypto.encode(s.sid),ya:crypto.encode(s.ya)},s).then(function(r){
        if(r.status===409){self.cancel();throw new Error('Код занят. Нажмите «Новый код».');}if(r.status!==204)throw new Error('Релей отклонил код: HTTP '+r.status);
        self.view={phase:'waiting',mode:'relay',code:code,qr:'incy://tv-pair/'+code,expires:Date.now()+300000};
        self.timer=setTimeout(function(){if(self.session===s){self.cancel();self.view={phase:'expired'};}},300000);
        self.poll(s);return self.view;
    });
}).catch(function(e){self.cancel();self.view={phase:'error',mode:'relay',error:e.message+' Код не зарегистрирован; QR не создан.'};throw new Error(self.view.error);});};
Pairing.prototype.poll=function(s){var self=this;self.request('GET','/pair/'+s.code+'/result',null,s).then(function(r){
    if(self.session!==s)return;
    if(r.status===204){self.poll(s);return;}
    if(r.status!==200)throw new Error(r.status===404?'Код истёк. Создайте новый.':'Ошибка релея: HTTP '+r.status);
    var payload=crypto.decrypt(s,r.body);self.cancel();self.view={phase:'importing'};
    return self.receive(payload).then(function(){self.view={phase:'received'};});
}).catch(function(e){if(self.session!==s && self.view.phase!=='importing')return;self.cancel();self.view={phase:'error',error:e.message || 'Не удалось расшифровать подключение'};});};
module.exports=Pairing;
