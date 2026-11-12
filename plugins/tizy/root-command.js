'use strict';
// The TV's .NET ProcessStartInfo argument parser alters nested shell quotes.
// Decode the exact script on stdin instead of passing it through that parser.
module.exports=function(command){return 'printf %s '+new Buffer(command,'utf8').toString('base64')+' | base64 -d | /bin/sh';};
