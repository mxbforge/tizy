'use strict';
// A new tunnel may need another request after an interrupted HTTP handshake.
// Bound retries here, independently of the user's three connection attempts.
module.exports=function(check,options){
    options=options||{};var wait=options.wait||function(){return new Promise(function(resolve){setTimeout(resolve,750);});};
    function attempt(retried){return Promise.resolve().then(check).then(function(code){
        if(String(code).trim()!=='204')throw new Error('VPN HTTP '+String(code).trim());
    }).catch(function(error){
        if(retried||!/curl: \((?:5|6|7|28|35|52|55|56)\)|VPN HTTP (?:000|408|425|429|50[234])/.test(error.message))throw error;
        if(options.retry)options.retry();return wait().then(function(){return attempt(true);});
    });}
    return attempt(false);
};
