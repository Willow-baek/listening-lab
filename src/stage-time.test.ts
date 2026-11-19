import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSessions, canAdvanceStage} from './domain';
import {recordStageTime} from './stage-time';
test('stage time includes pauses, background gaps and revisits without inventing legacy durations',()=>{
 const start=createSessions('https://youtu.be/E9sJp2bISxk',7,47,false)[0];
 const a=recordStageTime(start,1000);
 const b=recordStageTime(a,61000);
 assert.equal(b.stageElapsed?.[0],60);
 const c=recordStageTime({...b,step:1},91000);
 assert.equal(c.stageElapsed?.[1],30);
 assert.equal(recordStageTime({...c,step:0},101000).stageElapsed?.[0],70);
 const legacy=recordStageTime({...start,stageElapsed:undefined},1000);
 assert.equal(legacy.stageElapsed?.[1],null);
 const finished={...c,phase:'result' as const};
 assert.strictEqual(recordStageTime(finished,200000),finished);
});
test('only STEP 3–5 require ten repeats; STEP 6 is always available',()=>{
 const base={transcript:'',counts:[0,0,0]};
 for(const step of [2,3,4]) assert.equal(canAdvanceStage({...base,step}),false);
 assert.equal(canAdvanceStage({...base,step:5}),true);
 assert.equal(canAdvanceStage({...base,step:6}),true);
});
