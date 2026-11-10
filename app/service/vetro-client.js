'use strict';
// Discovery is strictly local to this TV. Never follows redirects or sends commands
// while scanning; /exec is used only after a validated, UID-0 Vetro /status.
var fs=require('fs'),http=require('http'),net=require('net'),path=require('path');
function validPort(p){return typeof p==='number'&&p>=1&&p<=65535&&Math.floor(p)===p;}
function identity(s){return !!(s&&s.app&&/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(s.app.version)&&typeof s.app.shell==='number'&&s.agent&&typeof s.agent.connected==='boolean'&&(s.mode==='tv-integration'||s.mode==='app-only'));}
function listeners(text){var out=[];String(text).split('\n').forEach(function(line){var f=line.trim().split(/\s+/);if(f[3]!=='0A'||!f[1])return;var p=parseInt(f[1].split(':')[1],16);if(validPort(p)&&out.indexOf(p)<0)out.push(p);});return out;}
function error(code,message){var e=new Error(message||code);e.code=code;return e;}
function Client(options){
 var o=options||{};this.cacheFile=o.cacheFile;this.concurrency=o.concurrency||16;this.connectTimeout=o.connectTimeout||250;this.requestTimeout=o.requestTimeout||900;this.execTimeout=o.execTimeout||35000;
 this.min=o.min||1;this.max=o.max||65535;this.defaults=o.defaults||[8099,9000];this.hints=o.hints||function(){var ports=[];['/proc/net/tcp','/proc/net/tcp6'].forEach(function(f){try{ports=ports.concat(listeners(fs.readFileSync(f,'utf8')));}catch(e){}});return ports;};
 this._probe=o.probe||null;this._port=null;this._savedPort=null;this._finding=null;this._closed=false;this._cancel=[];this._generation=0;this._retryAt=0;this.view={phase:'idle',port:null,checked:0,total:65535,rootReady:false};
}
Client.prototype._json=function(port,route,body,timeout){var self=this;return new Promise(function(resolve,reject){
 var req,timer,settled=false,data='',bytes=0,payload=body===null?null:JSON.stringify(body);
 function finish(e,value){if(settled)return;settled=true;clearTimeout(timer);var at=self._cancel.indexOf(cancel);if(at>=0)self._cancel.splice(at,1);if(req)req.destroy();if(e)reject(e);else resolve(value);}
 function cancel(){finish(error('VETRO_CLOSED'));}
 cancel.discovery=body===null;self._cancel.push(cancel);timer=setTimeout(function(){finish(error('VETRO_TIMEOUT'));},timeout);
 try{req=http.request({host:'127.0.0.1',port:port,path:route,method:payload?'POST':'GET',agent:false,headers:payload?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(payload),'Connection':'close'}:{'Accept':'application/json','Connection':'close'}},function(res){
  res.setEncoding('utf8');res.on('data',function(b){bytes+=Buffer.byteLength(b,'utf8');if(bytes>(payload?524288:262144))return finish(error('VETRO_RESPONSE_LIMIT'));data+=b.toString('utf8');});res.on('error',function(e){finish(e);});res.on('aborted',function(){finish(error('VETRO_ABORTED'));});res.on('end',function(){if(res.statusCode!==200)return finish(error('VETRO_HTTP_'+res.statusCode));try{finish(null,JSON.parse(data));}catch(e){finish(error('VETRO_BAD_JSON'));}});
 });req.on('error',function(e){finish(e);});req.end(payload);}catch(e){finish(e);}
 });};
Client.prototype._tcp=function(port){var self=this;return new Promise(function(resolve){var socket,timer,done=false;function finish(open){if(done)return;done=true;clearTimeout(timer);var at=self._cancel.indexOf(cancel);if(at>=0)self._cancel.splice(at,1);if(socket)socket.destroy();resolve(open);}function cancel(){finish(false);}cancel.discovery=true;self._cancel.push(cancel);timer=setTimeout(cancel,self.connectTimeout);try{socket=net.connect({host:'127.0.0.1',port:port});socket.once('connect',function(){finish(true);});socket.once('error',cancel);}catch(e){finish(false);}});};
Client.prototype._check=function(port){var self=this;if(self._probe)return Promise.resolve().then(function(){return self._probe(port);});return self._tcp(port).then(function(open){if(!open)return null;return self._json(port,'/status',null,self.requestTimeout).catch(function(){return null;});});};
Client.prototype._remember=function(port,status){this._port=port;this._retryAt=0;this.view.phase=status.agent.connected&&status.agent.uid===0?'connected':'waiting-root';this.view.port=port;this.view.rootReady=this.view.phase==='connected';if(this.cacheFile&&this._savedPort!==port)try{var tmp=this.cacheFile+'.tmp';fs.writeFileSync(tmp,JSON.stringify({port:port}),{mode:384});fs.renameSync(tmp,this.cacheFile);this._savedPort=port;}catch(e){}return {port:port,status:status};};
Client.prototype.find=function(){
 var self=this;if(self._closed)return Promise.reject(error('VETRO_CLOSED'));if(self._finding)return self._finding;
 if(Date.now()<self._retryAt)return Promise.reject(error('VETRO_NOT_FOUND'));
 var generation=++self._generation,priority=[],seen=Buffer.alloc(65536),next=self.min,found=null;
 function add(p){if(validPort(p)&&priority.indexOf(p)<0)priority.push(p);}
 add(self._port);try{if(self.cacheFile){var saved=JSON.parse(fs.readFileSync(self.cacheFile,'utf8')).port;add(saved);if(validPort(saved))self._savedPort=saved;}}catch(e){}self.defaults.forEach(add);try{self.hints().forEach(add);}catch(e){}
 self.view={phase:'searching',port:null,checked:0,total:self.max-self.min+1,rootReady:false};
 function take(){while(priority.length){var p=priority.shift();if(!seen[p]){seen[p]=1;return p;}}while(next<=self.max){var n=next++;if(!seen[n]){seen[n]=1;return n;}}return null;}
 function worker(){if(found||self._closed||generation!==self._generation)return Promise.resolve();var p=take();if(p===null)return Promise.resolve();return self._check(p).catch(function(){return null;}).then(function(s){self.view.checked++;if(found||self._closed||generation!==self._generation)return;if(identity(s)){found=self._remember(p,s);self._cancel.slice().forEach(function(cancel){if(cancel.discovery)cancel();});return;}return worker();});}
 // Check known ports/listeners first; an absent Vetro falls back to every port 1..65535.
 var fast=[];while(priority.length)fast.push(priority.shift());
 function checkFast(i){if(found||i>=fast.length||self._closed)return Promise.resolve();var p=fast[i];if(seen[p])return checkFast(i+1);seen[p]=1;return self._check(p).catch(function(){return null;}).then(function(s){self.view.checked++;if(identity(s))found=self._remember(p,s);return found?null:checkFast(i+1);});}
 self._finding=checkFast(0).then(function(){if(found)return;var workers=[];for(var i=0;i<self.concurrency;i++)workers.push(worker());return Promise.all(workers);}).then(function(){
  self._finding=null;if(self._closed)throw error('VETRO_CLOSED');if(found)return found;self._port=null;self.view.phase='not-found';self._retryAt=Date.now()+15000;throw error('VETRO_NOT_FOUND');
 },function(e){self._finding=null;throw e;});return self._finding;
};
Client.prototype.execute=function(command){var self=this;return self.find().then(function(target){
 if(target.status.mode!=='tv-integration'||!target.status.agent.connected||target.status.agent.uid!==0)throw error('VETRO_ROOT_PENDING');
 return self._json(target.port,'/exec',{cmd:command},self.execTimeout).then(function(r){if(!r||r.ok!==true)throw error('VETRO_EXEC_FAILED',r&&(r.error||r.stderr)||'Vetro command failed');return r.output||'';},function(e){self._port=null;self.view.phase='disconnected';self.view.rootReady=false;throw e;});
 });};
Client.prototype.close=function(){this._closed=true;this._generation++;this._cancel.slice().forEach(function(cancel){cancel();});};
module.exports=Client;module.exports.identity=identity;module.exports.listeners=listeners;
