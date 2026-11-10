'use strict';
var ports=require('./ports').values;
var net=require('net'),rng=require('crypto'),Bonjour=require('bonjour-service').Bonjour;
var localAddress=require('./addresses').localAddress;
var ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function LocalPairing(receive){this.receive=receive;this.server=null;this.server6=null;this.bonjour=null;this.timer=null;this.view={phase:'idle'};this.sockets=[];this.pending=null;this.attempts=0;}
LocalPairing.prototype.cancel=function(){if(this.timer)clearTimeout(this.timer);this.timer=null;if(this.bonjour){this.bonjour.destroy();this.bonjour=null;}if(this.server){try{this.server.close(function(){});}catch(e){}this.server=null;}if(this.server6){try{this.server6.close(function(){});}catch(e){}this.server6=null;}this.sockets.forEach(function(s){s.destroy();});this.sockets=[];this.pending=null;this.view={phase:'idle'};};
LocalPairing.prototype.start=function(){var self=this;self.cancel();self.attempts=0;
    return new Promise(function(resolve,reject){var random=rng.randomBytes(6),code='';for(var i=0;i<6;i++)code+=ALPHABET[random[i]&31];
        var handler=function(socket){
            if(!localAddress(socket.remoteAddress) || self.sockets.length>=3){socket.destroy();return;}
            self.sockets.push(socket);var buffer='',handled=false;socket.setEncoding('utf8');socket.setTimeout(15000,function(){socket.destroy();});socket.on('error',function(){});socket.on('close',function(){self.sockets=self.sockets.filter(function(s){return s!==socket;});});
            socket.on('data',function(chunk){
                buffer+=chunk.toString('utf8');if(Buffer.byteLength(buffer)>65536){socket.destroy();return;}
                var end=buffer.indexOf('\n');if(end<0 || handled)return;var line=buffer.slice(0,end).replace(/\r$/,'');buffer=buffer.slice(end+1);
                if(line==='PAIR '+code){socket.write('PAIRED\n');return;}
                if(self.view.phase!=='waiting'){socket.end('ERROR|Busy\n');return;}
                var raw;
                if(line.indexOf(code+'|')===0)raw=line.slice(7);
                else if(line.indexOf('CONFIG ')===0){raw=line.slice(7);if(raw.indexOf(code+'|')===0)raw=raw.slice(7);}
                else{socket.end('ERROR|Code mismatch\n');if(++self.attempts>=5){self.cancel();self.view={phase:'error',mode:'local',error:'Слишком много неверных попыток. Создайте новый код.'};}return;}
                try{
                    var payload=JSON.parse(raw),incoming;
                    if(payload.subscription && typeof payload.subscription.url==='string')incoming={v:1,type:'subscription',url:payload.subscription.url,name:payload.subscription.name};
                    else if(Array.isArray(payload.servers)&&payload.servers.length>0&&payload.servers.length<=200)incoming={v:1,type:'config',servers:payload.servers};
                    else throw new Error('Unsupported format');
                    self.pending=incoming;self.view={phase:'confirm',mode:'local',count:incoming.servers?incoming.servers.length:null};handled=true;
                    // Receipt is acknowledged now; import always requires a button press on the TV.
                    socket.end('OK\n');
                }catch(e){socket.end('ERROR|Invalid JSON\n');}
            });
        };var server=net.createServer(handler),server6=net.createServer(handler),listening=0;self.server=server;self.server6=server6;
        function failed(){self.cancel();self.view={phase:'error',mode:'local',error:'Не удалось открыть приёмник IPv4 и IPv6'};reject(new Error(self.view.error));}
        server.on('error',failed);server6.on('error',failed);
        function up(){if(++listening!==2)return;
            self.view={phase:'waiting',mode:'local',families:['IPv4','IPv6'],code:code,qr:JSON.stringify({type:'incy_pairing',code:code,port:ports.localPair,name:'INCY-TV-'+code}),expires:Date.now()+300000};
            try{self.bonjour=new Bonjour({},function(){self.view.error='Не удалось объявить телевизор в сети Bonjour';});
                ['incy-tv','incyvpn'].forEach(function(type){self.bonjour.publish({name:'INCY-TV-'+code,type:type,port:ports.localPair,txt:{name:'Samsung · TIZY'}});});
            }catch(e){self.cancel();reject(new Error('Служба Bonjour недоступна'));return;}
            self.timer=setTimeout(function(){self.cancel();self.view={phase:'expired',mode:'local'};},300000);resolve(self.view);
        }
        server.listen(ports.localPair,'0.0.0.0',up);server6.listen({port:ports.localPair,host:'::',ipv6Only:true},up);
    });
};
LocalPairing.prototype.accept=function(){var self=this;if(!self.pending)return Promise.reject(new Error('Нет полученного подключения'));
    var payload=self.pending;self.cancel();self.view={phase:'importing',mode:'local'};
    return self.receive(payload).then(function(){self.view={phase:'received',mode:'local'};},function(e){self.view={phase:'error',mode:'local',error:e.message};throw e;});
};
module.exports=LocalPairing;
