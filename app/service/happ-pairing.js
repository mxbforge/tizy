'use strict';
var net=require('net'),crypto=require('crypto'),profiles=require('./profiles');
var localAddress=require('./addresses').localAddress,localHost=require('./log-export').localHost;
var MAX=524288;
function normalize(text){
    if(typeof text!=='string'||Buffer.byteLength(text)>MAX||text.indexOf('\ufffd')>=0)throw new Error('Некорректные данные Happ');
    var lines=text.split(/\r?\n/).map(function(s){return s.trim();}).filter(Boolean);
    if(!lines.length||lines.length>200)throw new Error('Передайте от 1 до 200 серверов или подписок');
    return lines.map(function(line){
        if(/^happ:\/\/crypt/i.test(line))throw new Error('Зашифрованные ссылки Happ пока не поддерживаются. Передайте обычную ссылку сервера или подписки.');
        if(line.indexOf('happ://add/')===0)line=line.slice(11);
        if(/^https:\/\//.test(line)){
            var u=require('url').parse(line);
            if(!u.hostname||u.auth||u.port&&u.port!=='443')throw new Error('Подписка должна быть публичной HTTPS-ссылкой на порту 443');
        }else profiles.parseMany(line);
        return line;
    }).join('\n');
}
function HappPairing(receive,options){options=options||{};this.receive=receive;this.host=options.host;this.allow=options.allow||localAddress;this.lifetime=options.lifetime||300000;this.socketTimeout=options.socketTimeout||15000;this.idleTimeout=options.idleTimeout||1000;this.notify=options.event||function(){};this.autoImport=options.autoImport!==false;this.view={phase:'idle',mode:'happ-local'};this.server=null;this.sockets=[];this.pending=null;this.serial=0;this.timer=null;this.completed=null;}
HappPairing.prototype.closeListener=function(){var server=this.server;this.server=null;this.sockets.forEach(function(s){s.destroy();});this.sockets=[];return new Promise(function(resolve){if(server)server.close(function(){resolve();});else resolve();});};
HappPairing.prototype.cancel=function(phase,preserveImport){if(preserveImport&&this.view.phase==='importing')return this.closeListener();this.serial++;clearTimeout(this.timer);this.timer=null;this.pending=null;this.view={phase:phase||'idle',mode:'happ-local'};return this.closeListener();};
HappPairing.prototype.fail=function(message,bytes){clearTimeout(this.timer);this.timer=null;this.pending=null;this.view={phase:'error',mode:'happ-local',error:message,receivedBytes:bytes||0};this.notify('Ошибка приёма Happ','error',message);this.closeListener();};
HappPairing.prototype.start=function(){
    var self=this,stopped=self.cancel(),serial=self.serial;self.view={phase:'starting',mode:'happ-local'};
    return stopped.then(function(){
        if(serial!==self.serial)return self.view;
        var host=self.host||localHost(),server=net.createServer(function(socket){
            if(serial!==self.serial||self.view.phase!=='waiting'||!self.allow(socket.remoteAddress)){socket.destroy();return;}
            self.sockets.push(socket);var chunks=[],size=0,finished=false,idle;
            function finish(){
                if(finished||serial!==self.serial||['waiting','receiving'].indexOf(self.view.phase)<0)return;
                finished=true;clearTimeout(idle);
                if(!size)return;
                try{self.pending=normalize(Buffer.concat(chunks).toString('utf8'));}catch(e){self.fail(e.message,size);return;}
                self.view={phase:'confirm',mode:'happ-local',count:self.pending.split('\n').length,expires:self.view.expires,receivedBytes:size};
                self.notify('Данные Happ получены','info','bytes='+size+'; items='+self.view.count);self.closeListener();
                if(self.autoImport){self.completed=self.accept();self.completed.catch(function(){});}
            }
            function failed(message){if(finished||serial!==self.serial)return;finished=true;clearTimeout(idle);self.fail(message,size);socket.destroy();}
            socket.setTimeout(self.socketTimeout,function(){failed('Телефон не завершил передачу Happ. Повторите отправку.');});
            socket.on('error',function(){failed('Соединение Happ прервано. Повторите отправку.');});
            socket.on('close',function(){clearTimeout(idle);self.sockets=self.sockets.filter(function(s){return s!==socket;});});
            socket.on('data',function(b){
                if(finished)return;size+=b.length;if(size>MAX){failed('Данные Happ превышают 512 КБ');return;}chunks.push(b);
                if(self.view.phase==='waiting'){self.view.phase='receiving';self.view.receivedBytes=0;self.notify('Телефон подключился к приёмнику Happ','debug');}
                self.view.receivedBytes=size;clearTimeout(idle);
                // Some senders keep the socket open after their final newline.
                if(b[b.length-1]===10)idle=setTimeout(finish,self.idleTimeout);
            });
            socket.on('end',finish);
        });self.server=server;server.maxConnections=2;
        return new Promise(function(resolve,reject){
            server.once('error',function(){if(serial!==self.serial)return resolve(self.view);self.fail('Не удалось открыть приём Happ в домашней сети.');reject(new Error(self.view.error));});
            server.listen(0,host,function(){
                if(serial!==self.serial){server.close();resolve(self.view);return;}
                var info={uid:'TIZY-'+crypto.randomBytes(16).toString('hex'),ip:host,port:server.address().port};
                self.view={phase:'waiting',mode:'happ-local',qr:'happ://send_to_device/'+Buffer.from(JSON.stringify(info),'utf8').toString('base64'),expires:Date.now()+self.lifetime,receivedBytes:0};
                self.notify('Приём Happ открыт','info','IPv4; port='+info.port);
                self.timer=setTimeout(function(){self.cancel('expired');self.notify('Срок QR Happ истёк','warning');},self.lifetime);if(self.timer.unref)self.timer.unref();resolve(self.view);
            });
        });
    }).catch(function(e){if(serial===self.serial)self.fail(e.message==='Для экспорта подключите ТВ к домашней сети IPv4.'?'Для Happ подключите ТВ к домашней сети IPv4.':e.message);throw new Error(self.view.error||'Не удалось открыть приём Happ в домашней сети.');});
};
HappPairing.prototype.accept=function(){
    var self=this,serial=self.serial;
    if(self.view.phase!=='confirm'||!self.pending||Date.now()>=self.view.expires)return Promise.reject(new Error('Нет данных Happ для подтверждения'));
    var text=self.pending,bytes=self.view.receivedBytes;self.pending=null;clearTimeout(self.timer);self.timer=null;self.view={phase:'importing',mode:'happ-local',receivedBytes:bytes};
    return Promise.resolve().then(function(){return self.receive(text,function(){return serial===self.serial;});}).then(function(){if(serial===self.serial)self.view={phase:'received',mode:'happ-local',receivedBytes:bytes};},function(e){if(serial===self.serial)self.fail(e.message,bytes);throw e;});
};
module.exports=HappPairing;module.exports.normalize=normalize;
