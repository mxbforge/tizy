'use strict';
var ipaddr=require('ipaddr.js'),os=require('os');
function parse(s){return ipaddr.process(s.split('%')[0]);}
function publicIP(s){try{return parse(s).range()==='unicast';}catch(e){return false;}}
function localAddress(ip){
    var remote;try{remote=parse(ip);}catch(e){return false;}
    if(remote.range()==='loopback')return true;
    var interfaces=os.networkInterfaces(),found=false;
    Object.keys(interfaces).forEach(function(n){interfaces[n].forEach(function(a){
        if(a.internal || !a.netmask)return;
        try{var address=parse(a.address),mask=parse(a.netmask);if(address.kind()!==remote.kind())return;var prefix=mask.prefixLengthFromSubnetMask();if(prefix!==null && remote.match(address,prefix))found=true;}catch(e){}
    });});return found;
}
module.exports={localAddress:localAddress,publicIP:publicIP};
