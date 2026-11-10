const assert=require('node:assert/strict'),AutoConnect=require('../app/service/auto-connect');
(async()=>{
 let s={enabled:false,ready:true,selected:'first',phase:'disconnected',busy:false,paused:false},calls=[],fail=false,release,gate;
 const auto=new AutoConnect({get:()=>s,connect:async id=>{calls.push(id);if(fail)throw Error('Network unavailable');if(gate)await gate;}});
 await auto.tick();assert.equal(calls.length,0);
 s.enabled=true;s.ready=false;await auto.tick();assert.equal(calls.length,0);s.ready=true;s.paused=true;await auto.tick();assert.equal(auto.view().phase,'paused');assert.equal(calls.length,0);
 s.paused=false;s.busy=true;await auto.tick();assert.equal(calls.length,0);s.busy=false;s.selected='last-selected';
 gate=new Promise(r=>release=r);const pending=auto.tick();await Promise.resolve();assert.equal(auto.view().phase,'connecting');await auto.tick();assert.deepEqual(calls,['last-selected']);release();await pending;await auto.tick();assert.equal(calls.length,1,'Successful startup must not reconnect repeatedly');
 auto.reset();fail=true;gate=null;await auto.tick();assert.equal(auto.view().phase,'retrying');await auto.tick();assert.equal(calls.length,2,'Respect retry backoff');
 auto.nextRetryAt=0;fail=false;s.selected='new-selected';await auto.tick();assert.equal(calls[2],'new-selected');assert.equal(auto.fulfilled,true);
 auto.reset();s.paused=true;await auto.tick();assert.equal(calls.length,3,'Manual disconnect must stay paused');
 s.paused=false;s.enabled=false;await auto.tick();assert.equal(auto.view().phase,'disabled');assert.equal(calls.length,3);
 
 s.wanted=true;s.enabled=false;s.paused=false;auto.reset();await auto.tick();assert.equal(calls.length,4,'Manual sessions reconnect even with boot auto-connect disabled');s.phase='connected';await auto.tick();s.phase='error';auto.lost();await auto.tick();assert.equal(calls.length,4,'Initial reconnect delay must be respected');auto.nextRetryAt=0;await auto.tick();assert.equal(calls.length,5,'Connection loss must rearm a fulfilled session');auto.lost();auto.nextRetryAt=0;s.paused=true;s.wanted=false;await auto.tick();assert.equal(calls.length,5,'Manual disconnect must cancel pending reconnection');

 let manualState={enabled:true,wanted:true,paused:false,phase:'error',ready:false,busy:false,selected:'manual-server'},manualCalls=0,exhaustions=0;
 const limited=new AutoConnect({get:()=>manualState,connect:async()=>{manualCalls++;throw Error('Connection failed');},exhausted:()=>{exhaustions++;manualState.paused=true;manualState.wanted=false;}});
 await assert.rejects(limited.manual('manual-server'));assert.equal(limited.attempts,1);assert.equal(limited.view().maxAttempts,3);await limited.tick();assert.equal(manualCalls,1,'Keep the delay after the initial manual attempt');limited.nextRetryAt=0;await limited.tick();assert.equal(manualCalls,2);limited.nextRetryAt=0;await limited.tick();assert.equal(manualCalls,3);assert.equal(limited.view().phase,'exhausted');assert.equal(limited.view().wanted,false);assert.equal(exhaustions,1);limited.nextRetryAt=0;await limited.tick();assert.equal(manualCalls,3,'No fourth attempt even when boot auto-connect is enabled');
 manualState.paused=false;manualState.wanted=true;limited.options.connect=async()=>{manualCalls++;};await limited.manual('manual-server');assert.equal(manualCalls,4);assert.equal(limited.attempts,1,'A new manual press resets the three-attempt budget');assert.equal(limited.exhausted,false);assert.equal(limited.manualLimit,null,'A successful session returns to normal drop recovery');
 console.log('Startup waits for readiness, last server, single in-flight attempt, backoff, manual pause and disable: passed');
})().catch(e=>{console.error(e);process.exitCode=1});
