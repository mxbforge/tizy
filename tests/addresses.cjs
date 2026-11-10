const assert=require('node:assert/strict'),a=require('../app/service/addresses'),p=require('../app/service/profiles'),n=require('../app/service/network');
assert.ok(a.localAddress('127.0.0.1'));assert.ok(a.localAddress('::1'));assert.ok(a.localAddress('::ffff:127.0.0.1'));
for(const ip of ['::1','fd00::1','fe80::1','127.0.0.1','::ffff:127.0.0.1','192.168.2.1','169.254.1.2','100.64.1.2'])assert.equal(a.publicIP(ip),false,ip);
for(const ip of ['1.1.1.1','2606:4700:4700::1111'])assert.equal(a.publicIP(ip),true,ip);
const server=p.parse('vless://11111111-2222-4333-8444-555555555555@[2001:db8::1]:443?security=reality&pbk=abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ&sni=example.org');
assert.equal(server.host,'2001:db8::1');assert.equal(p.config(server).inbounds[2].listen,'::1');
assert.ok(n.preflight().includes('ip6tables -t nat -S OUTPUT'));assert.ok(n.install().includes('ip6tables -t nat -A SEVER_XRAY -j REDIRECT --to-ports 19082'));assert.ok(n.cleanup().includes('ip6tables -t nat -D OUTPUT -p tcp -j SEVER_XRAY'));
console.log('IPv4/IPv6 address parsing, mapped addresses, public subscription guards and dual-family route plan: passed');
