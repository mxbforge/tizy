'use strict';
var fs=require('fs'),path=require('path'),crypto=require('crypto');
var apiPorts=[19090];for(var n=19100;n<=19131;n++)apiPorts.push(n);
function atomic(file,value){var tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(value),{mode:384});fs.chmodSync(tmp,384);fs.renameSync(tmp,file);}
function token(dir){var file=path.join(dir,'local-key.json');try{var s=JSON.parse(fs.readFileSync(file,'utf8'));if(s&&/^[a-f0-9]{64}$/.test(s.token))return s.token;}catch(e){}var key=crypto.randomBytes(32).toString('hex');atomic(file,{token:key});return key;}
function listen(server,dir,key){return new Promise(function(resolve,reject){var at=0;function attempt(){if(at>=apiPorts.length)return reject(new Error('TIZY_API_PORTS_BUSY'));server.listen(apiPorts[at++],'127.0.0.1');}function failed(e){if(e.code==='EADDRINUSE')return attempt();server.removeListener('error',failed);reject(e);}server.on('error',failed);server.once('listening',function(){server.removeListener('error',failed);var port=server.address().port;try{atomic(path.join(dir,'tizy-endpoint.json'),{version:1,port:port,token:key});resolve(port);}catch(e){server.close();reject(e);}});attempt();});}
module.exports={token:token,listen:listen,apiPorts:apiPorts,atomic:atomic};
