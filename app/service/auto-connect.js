'use strict';
// Manual disconnect pauses only this boot, including backend restarts.
function AutoConnect(options){this.options=options;this.running=false;this.reset();}
AutoConnect.prototype.reset=function(){this.nextRetryAt=0;this.attempts=0;this.fulfilled=false;this.manualLimit=null;this.exhausted=false;this.exhaustedAt=0;};
AutoConnect.prototype.lost=function(){this.reset();this.nextRetryAt=Date.now()+5000;};
AutoConnect.prototype.view=function(){var s=this.options.get(),wanted=!!(s.enabled||s.wanted)&&!s.paused&&!this.exhausted;return {phase:this.exhausted?'exhausted':s.paused?'paused':!wanted?'disabled':s.phase==='connected'?'connected':this.running?'connecting':this.fulfilled?'idle':this.nextRetryAt>Date.now()?'retrying':'waiting',wanted:wanted,attempts:this.attempts,maxAttempts:this.manualLimit,exhaustedAt:this.exhaustedAt,nextRetryAt:this.nextRetryAt};};
AutoConnect.prototype.run=function(id){var self=this;self.running=true;self.attempts++;return Promise.resolve().then(function(){return self.options.connect(id,{manual:!!self.manualLimit,attempt:self.attempts,maxAttempts:self.manualLimit});}).then(function(value){self.fulfilled=true;self.nextRetryAt=0;self.manualLimit=null;return value;},function(e){
    if(self.manualLimit&&self.attempts>=self.manualLimit){self.exhausted=true;self.exhaustedAt=Date.now();self.nextRetryAt=0;if(self.options.exhausted)self.options.exhausted();}
    else self.nextRetryAt=Date.now()+Math.min(60000,5000*Math.pow(2,Math.min(self.attempts-1,4)));
    throw e;
}).then(function(value){self.running=false;return value;},function(e){self.running=false;throw e;});};
AutoConnect.prototype.manual=function(id){this.reset();this.manualLimit=3;return this.run(id);};
AutoConnect.prototype.tick=function(){var self=this,s=self.options.get();if(s.phase==='connected'){self.fulfilled=true;self.manualLimit=null;return Promise.resolve();}if((!s.enabled&&!s.wanted)||s.paused||self.exhausted||self.fulfilled||self.running||s.busy||(!s.ready&&!self.manualLimit)||!s.selected||s.phase==='connecting'||s.phase==='disconnecting'||Date.now()<self.nextRetryAt)return Promise.resolve();return self.run(s.selected).catch(function(){});};
module.exports=AutoConnect;
