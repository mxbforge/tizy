'use strict';
var crypto=require('crypto'),WebSocket=require('ws'),profiles=require('./profiles');
var ENDPOINT='wss://vault.v2raytunpulse.com',MAX=524288;
function decode(value){
    if(value===null||value===undefined||Buffer.byteLength(typeof value==='string'?value:JSON.stringify(value))>MAX)throw new Error('Некорректные данные v2RayTun');
    if(typeof value==='string'){
        var text=value.trim(),prefix='v2raytun://import/';
        if(/^v2raytun:\/\/crypt\//i.test(text))throw new Error('Зашифрованные ссылки v2RayTun пока не поддерживаются. Передайте обычную ссылку сервера или подписки.');
        if(text.indexOf(prefix)===0){text=text.slice(prefix.length);if(/^https?%3a/i.test(text))text=decodeURIComponent(text);}
        if(/^[\[{]/.test(text)){try{value=JSON.parse(text);}catch(e){throw new Error('Некорректная конфигурация v2RayTun');}}
        else{if(/^https:\/\//.test(text))return {text:text};profiles.parseMany(text);return {text:text};}
    }
    var list=Array.isArray(value)?value:[value];
    if(!list.length||list.length>200||list.some(function(p){return !p||typeof p!=='object'||Array.isArray(p);}))throw new Error('Некорректная конфигурация v2RayTun');
    return {profiles:list.map(function(p){return profiles.fromIncy(p);})};
}
function newKey(){var b=crypto.randomBytes(16);b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;return b.toString('hex');}
function Pairing(receive,options){options=options||{};this.receive=receive;this.endpoint=options.endpoint||ENDPOINT;this.Socket=options.Socket||WebSocket;this.lifetime=options.lifetime||300000;this.timeout=options.timeout||15000;this.event=options.event||function(){};this.view={phase:'idle',mode:'v2raytun-relay'};this.serial=0;this.socket=null;this.key=null;this.timer=null;this.heartbeat=null;this.starting=null;this.completed=null;}
Pairing.prototype.close=function(remove){
    clearTimeout(this.timer);clearInterval(this.heartbeat);this.timer=null;this.heartbeat=null;
    var socket=this.socket,key=this.key;this.socket=null;this.key=null;
    if(!socket)return;
    if(socket.readyState===1){if(remove&&key){try{socket.send(JSON.stringify({action:'REMOVE',key:key}));socket.send(JSON.stringify({action:'UNSUBSCRIBE',key:key}));}catch(e){}}try{socket.close(1000);}catch(e){socket.terminate();}var timer=setTimeout(function(){socket.terminate();},1000);if(timer.unref)timer.unref();socket.once('close',function(){clearTimeout(timer);});}
    else socket.terminate();
};
Pairing.prototype.cancel=function(phase,preserveImport){if(preserveImport&&this.view.phase==='importing')return;this.serial++;this.close(true);this.view={phase:phase||'idle',mode:'v2raytun-relay'};if(this.starting){var reject=this.starting;this.starting=null;reject(new Error('Передача отменена'));}};
Pairing.prototype.start=function(){
    var self=this;self.cancel();var serial=self.serial,key=newKey();self.key=key;self.view={phase:'starting',mode:'v2raytun-relay'};
    return new Promise(function(resolve,reject){
        self.starting=reject;var alive=true,socket;
        function fail(message){if(serial!==self.serial)return;self.serial++;self.close(true);self.view={phase:'error',mode:'v2raytun-relay',error:message};self.event('Ошибка приёма v2RayTun','error',message);if(self.starting){self.starting=null;reject(new Error(message));}}
        try{socket=new self.Socket(self.endpoint,{handshakeTimeout:self.timeout,maxPayload:MAX,perMessageDeflate:false,followRedirects:false});}catch(e){fail('Сервер передачи v2RayTun недоступен. Повторите попытку.');return;}self.socket=socket;
        self.timer=setTimeout(function(){fail('Сервер передачи v2RayTun не ответил. Повторите попытку.');},self.timeout);
        socket.on('open',function(){if(serial!==self.serial)return;socket.send(JSON.stringify({action:'SUBSCRIBE',key:key}));});
        socket.on('pong',function(){alive=true;});
        socket.on('message',function(data,isBinary){
            if(serial!==self.serial||['starting','waiting'].indexOf(self.view.phase)<0)return;
            if(isBinary){fail('Некорректный ответ сервера передачи v2RayTun');return;}
            var message;try{message=JSON.parse(data.toString('utf8'));}catch(e){fail('Некорректный ответ сервера передачи v2RayTun');return;}
            if(message.status==='ERROR'){fail('Сервер передачи v2RayTun отклонил запрос. Создайте новый QR-код.');return;}
            if(message.status==='SUCCESS'&&self.view.phase==='starting'){
                clearTimeout(self.timer);self.starting=null;self.view={phase:'waiting',mode:'v2raytun-relay',qr:key,expires:Date.now()+self.lifetime};
                self.event('Приём v2RayTun открыт','info');self.timer=setTimeout(function(){if(serial===self.serial)self.cancel('expired');},self.lifetime);if(self.timer.unref)self.timer.unref();
                self.heartbeat=setInterval(function(){if(serial!==self.serial)return;if(!alive){fail('Соединение с сервером передачи v2RayTun прервано. Создайте новый QR-код.');return;}alive=false;try{socket.ping();}catch(e){fail('Соединение с сервером передачи v2RayTun прервано. Создайте новый QR-код.');}},20000);if(self.heartbeat.unref)self.heartbeat.unref();resolve(self.view);return;
            }
            if(message.status!=='UPDATE'||message.key!==key||self.view.phase!=='waiting')return;
            if(message.value===null||message.value===undefined)return;
            var payload;try{payload=decode(message.value);}catch(e){fail(e.message);return;}
            var bytes=Buffer.byteLength(typeof message.value==='string'?message.value:JSON.stringify(message.value));
            self.view={phase:'importing',mode:'v2raytun-relay',receivedBytes:bytes};self.close(true);self.event('Данные v2RayTun получены','info','bytes='+bytes);
            self.completed=Promise.resolve().then(function(){return self.receive(payload,function(){return serial===self.serial;});}).then(function(){if(serial===self.serial)self.view={phase:'received',mode:'v2raytun-relay',receivedBytes:bytes};},function(e){fail(e.message);});
        });
        socket.on('error',function(){if(serial===self.serial&&['starting','waiting'].indexOf(self.view.phase)>=0)fail('Сервер передачи v2RayTun недоступен. Повторите попытку.');});
        socket.on('close',function(){if(serial===self.serial&&['starting','waiting'].indexOf(self.view.phase)>=0)fail('Соединение с сервером передачи v2RayTun прервано. Создайте новый QR-код.');});
    });
};
module.exports=Pairing;module.exports.decode=decode;module.exports.endpoint=ENDPOINT;
