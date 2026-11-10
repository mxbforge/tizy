const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const tv=require('../app/service/network-tv'),network=require('../app/service/network'),profiles=require('../app/service/profiles');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sever-firewall-'));
const mock=`#!/usr/bin/env node
const fs=require('fs'),path=require('path');const tool=path.basename(process.argv[1]),a=process.argv.slice(2),file=process.env.RULES;const s=JSON.parse(fs.readFileSync(file)),table=a[1],op=a[2],chain=a[3],key=tool+':'+table;const t=s[key]||(s[key]={OUTPUT:[]});let ok=true;
if(process.env.FAIL_IPV6==='1'&&tool==='ip6tables'&&op==='-I')process.exit(1);
if(op==='-N'){if(t[chain])ok=false;else t[chain]=[];}
else if(op==='-A'){if(!t[chain])ok=false;else t[chain].push(a.slice(4));}
else if(op==='-I'){t[chain].unshift(a.slice(5));}
else if(op==='-D'||op==='-C'){const at=(t[chain]||[]).findIndex(r=>JSON.stringify(r)===JSON.stringify(a.slice(4)));if(at<0)ok=false;else if(op==='-D')t[chain].splice(at,1);}
else if(op==='-F'){if(t[chain])t[chain]=[];else ok=false;}
else if(op==='-X'){if(t[chain])delete t[chain];else ok=false;}
fs.writeFileSync(file,JSON.stringify(s));process.exit(ok?0:1);
`;
try{
 for(const name of ['iptables','ip6tables'])fs.writeFileSync(path.join(dir,name),mock,{mode:0o755});
 const keep=['-j','EXISTING_USER_CHAIN'],file=path.join(dir,'rules.json');
 const initial=()=>({'iptables:nat':{OUTPUT:[keep],EXISTING_USER_CHAIN:[]},'iptables:filter':{OUTPUT:[keep],EXISTING_USER_CHAIN:[]},'ip6tables:filter':{OUTPUT:[keep],EXISTING_USER_CHAIN:[]}});
 function run(fail){fs.writeFileSync(file,JSON.stringify(initial()));return cp.spawnSync('/bin/sh',['-c',tv.install()],{env:{...process.env,PATH:dir+':'+process.env.PATH,RULES:file,FAIL_IPV6:fail?'1':'0'},encoding:'utf8'});}
 assert.equal(run(false).status,0);const rules=JSON.parse(fs.readFileSync(file));
 const nat=rules['iptables:nat'].SEVER_TV_NAT,filter6=rules['ip6tables:filter'].SEVER_TV_OUT;
 assert.deepEqual(nat[0],['-m','cgroup','--cgroup',String(tv.classId),'-j','RETURN']);
 assert.ok(nat.findIndex(r=>r.includes('53'))<nat.findIndex(r=>r.includes('192.168.0.0/16')),'LAN resolver DNS must be intercepted before LAN exclusion');
 assert.ok(filter6.findIndex(r=>r.includes('53'))<filter6.findIndex(r=>r.includes('fe80::/10')),'Router IPv6 DNS must not escape through link-local exception');
 assert.ok(filter6.findIndex(r=>r.includes('lo'))>=0&&filter6.findIndex(r=>r.includes('lo'))<filter6.findIndex(r=>r.includes('REJECT')),'Local IPv6 REJECT replies must reach the client for prompt IPv4 fallback');
 assert.equal(run(true).status,1);assert.deepEqual(JSON.parse(fs.readFileSync(file)),initial(),'Partial installation must restore unrelated rules and remove our jumps/chains');
 const p=profiles.parse('vless://11111111-2222-4333-8444-555555555555@example.com:443?security=reality&pbk=test#Test');
 const cfg=profiles.config(p,'tv'),dns=cfg.outbounds.find(o=>o.tag==='dns-via-proxy');
 assert.equal(dns.settings.rewriteNetwork,'tcp');assert.equal(dns.streamSettings.sockopt.dialerProxy,'proxy');assert.equal(dns.settings.rules[0].action,'direct');
 assert.equal(cfg.inbounds.find(i=>i.tag==='tv-dns').listen,'127.0.0.1');
 assert.equal(cp.spawnSync('/bin/sh',['-n','-c',network.start('/tmp/sever','/tmp/core','tv')]).status,0);
 console.log('DNS before LAN exclusions, cgroup loop prevention, IPv6 DNS block, partial-rule rollback and current Xray DNS chaining: passed');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
