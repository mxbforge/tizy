(function(){'use strict';
var allowed=[19090];for(var n=19100;n<=19131;n++)allowed.push(n);
function validate(s){return s&&s.version===1&&allowed.indexOf(s.port)>=0&&/^[a-f0-9]{64}$/.test(s.token);}
window.TizyBootstrap={read:function(done){
 if(typeof tizen==='undefined'||!tizen.filesystem){if(!window.TIZY_DISTRIBUTABLE&&window.SEVER_TOKEN)return done(null,{port:19090,token:window.SEVER_TOKEN});return done(new Error('TIZY_BOOTSTRAP_UNAVAILABLE'));}
 try{tizen.filesystem.resolve('wgt-private/tizy-endpoint.json',function(file){file.readAsText(function(text){try{var s=JSON.parse(text);if(!validate(s))throw new Error('TIZY_BOOTSTRAP_INVALID');done(null,s);}catch(e){done(e);}},done,'UTF-8');},done,'r');}catch(e){done(e);}
},valid:validate};
})();
