import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractTracks, json3Cues } from './youtube-captions';
test('caption track parser handles escaped strings and absent tracks', () => {
 const tracks = [{baseUrl:'https://www.youtube.com/api/timedtext?v=a&name=[test]',languageCode:'en-GB'}];
 assert.deepEqual(extractTracks('data={"captionTracks":'+JSON.stringify(tracks)+',"other":1}'),tracks);
 assert.deepEqual(extractTracks('no captions'),[]);
});
test('json3 keeps original caption start and duration and decodes entities', () => {
 assert.deepEqual(json3Cues({events:[{tStartMs:8100,dDurationMs:2100,segs:[{utf8:'Tom &amp; '},{utf8:'Jerry'}]},{tStartMs:0}]}),[{start:8.1,end:10.2,text:'Tom & Jerry'}]);
 assert.deepEqual(json3Cues({}),[]);
});
