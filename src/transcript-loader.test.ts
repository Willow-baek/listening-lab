import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSessions} from './domain';
import {KNOWN_CAPTIONS} from './known-captions';
import {firstSpeechRange} from './transcript-cues';
import {hydrateKnownTranscript} from './transcript-loader';
test('refund video includes real captions and starts at the first line for forty seconds',()=>{
 const cues=KNOWN_CAPTIONS.E9sJp2bISxk;
 assert.deepEqual(firstSpeechRange(cues),{start:7,end:47});
 const session=createSessions('https://www.youtube.com/watch?v=E9sJp2bISxk',7,47,false)[0];
 const hydrated=hydrateKnownTranscript(session);
 assert.ok(hydrated.transcript.length>100);
 assert.equal(hydrated.transcriptCues?.[0].start,7);
 assert.equal(hydrated.step,0);
 assert.strictEqual(hydrateKnownTranscript(hydrated),hydrated);
});
test('automatic caption preparation preserves user text, editing drafts, results and unknown videos',()=>{
 const session=createSessions('https://www.youtube.com/watch?v=E9sJp2bISxk',7,47,false)[0];
 assert.equal(hydrateKnownTranscript({...session,transcript:'My custom script.'}).transcript,'My custom script.');
 assert.equal(hydrateKnownTranscript(session,true).transcript,'');
 const result={...session,phase:'result' as const};
 assert.strictEqual(hydrateKnownTranscript(result),result);
 const unknown={...session,videoId:'abcdefghijk'};
 assert.strictEqual(hydrateKnownTranscript(unknown),unknown);
});
