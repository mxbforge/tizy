'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict'),{spawnSync}=require('child_process'),{EventEmitter}=require('events');
if(process.argv[2]==='child'){
 const dir=process.argv[3],file=path.join(dir,'config.json');
 const plugin=require('../plugins/tizy')({dir,config:{get:()=>fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{},set:value=>{fs.writeFileSync(file+'.tmp',JSON.stringify(value));fs.renameSync(file+'.tmp',file);}},execute:async()=>({exit_code:0,stdout:''})});
 (async()=>{plugin.start();for(let i=0;i<10;i++)await new Promise(r=>setImmediate(r));if(process.argv[4]!=='read'){const enabled=process.argv[4]==='true',request=new EventEmitter();request.method='POST';let status;const done=new Promise(resolve=>{plugin.route(request,{writeHead:c=>status=c,end:resolve},'settings');});request.emit('data',JSON.stringify({autoConnect:enabled}));request.emit('end');await done;assert.equal(status,200);}console.log(String(plugin.status().settings.autoConnect));plugin.stop();})().catch(e=>{console.error(e);process.exitCode=1;});
}else{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tizy-settings-'));
 try{for(const value of ['true','false']){for(const operation of [value,'read']){const r=spawnSync(process.execPath,[__filename,'child',dir,operation],{encoding:'utf8',timeout:10000});assert.equal(r.status,0,r.stderr);assert.equal(r.stdout.trim(),value,'Auto-connect survives a fresh process');}assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'config.json'),'utf8')).state.settings.autoConnect,value==='true');}console.log('Settings: auto-connect on/off persists on disk across independent processes');}finally{fs.rmSync(dir,{recursive:true,force:true});}
}
