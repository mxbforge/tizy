'use strict';
// Runtime ports follow one plan; if Vetro uses one, move that listener and every
// corresponding Xray, curl and firewall reference together.
var defaults={socks:19080,tcp:19081,tcp6:19082,stats:19085,dns:19053,localPair:19091};
var values={};Object.keys(defaults).forEach(function(k){values[k]=defaults[k];});
function avoid(port){var used={};used[port]=true;Object.keys(values).forEach(function(k){if(values[k]!==port)used[values[k]]=true;});Object.keys(values).forEach(function(k){if(values[k]===port){var candidate=defaults[k]+1000;while(used[candidate])candidate++;values[k]=candidate;used[candidate]=true;}});}
module.exports={values:values,avoid:avoid};
