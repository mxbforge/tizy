// Workflow tests mock process attribution; app-proxy.cjs exercises the real monitor.
const apps=require('../../app/service/app-proxy');apps.Monitor=function(){this.error='';};apps.Monitor.prototype.start=function(){this.error='';};apps.Monitor.prototype.stop=function(){};
