const {spawnSync}=require('node:child_process'),path=require('node:path');
const groups={unit:['root-command','addresses','profiles','ip-family','port-plan','runtime','installation','logging','log-export','app-labels','auto-connect','tunnel-check','traffic','connection-info','app-proxy'],integration:['vetro-discovery','backend','manual-limit',['reconnect','--wake-only'],['reconnect','--app-proxy']]};
const list=groups[process.argv[2]||'unit'];if(!list)throw Error('Unknown test group');
for(const item of list){const [name,...args]=Array.isArray(item)?item:[item];const r=spawnSync(process.execPath,[path.join(__dirname,'../tests',name+'.cjs'),...args],{stdio:'inherit'});if(r.status!==0)process.exit(r.status||1);}
