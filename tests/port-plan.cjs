const assert=require('assert/strict'),ports=require('../app/service/ports'),profiles=require('../app/service/profiles'),network=require('../app/service/network'),tv=require('../app/service/network-tv'),apps=require('../app/service/app-proxy'),traffic=require('../app/service/traffic');
for(const p of Object.values(ports.values))ports.avoid(p);
const values=Object.values(ports.values);assert.equal(new Set(values).size,values.length);assert.ok(values.every(p=>p>=20000));
const profile=profiles.parse('vless://00000000-0000-4000-8000-000000000001@example.invalid:443?security=tls#Test'),config=profiles.config(profile,'tv','auto');
assert.equal(config.inbounds.find(p=>p.tag==='local-socks').port,ports.values.socks);assert.equal(config.inbounds.find(p=>p.tag==='tv-dns').port,ports.values.dns);assert.equal(config.api.listen,'127.0.0.1:'+ports.values.stats);
assert.ok(network.install().includes('--to-ports '+ports.values.tcp6));assert.ok(tv.install().includes('--to-ports '+ports.values.dns));assert.ok(traffic.command('/core').includes('127.0.0.1:'+ports.values.stats));assert.ok(apps.resetDirect('iptables',{enabled:false},false).every(s=>!s.includes('19081')));
console.log('Vetro collisions relocate Xray listeners, statistics and firewall ports consistently: passed');
