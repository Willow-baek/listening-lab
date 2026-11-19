import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transcriptCues, validClipRange } from './transcript-cues';
test('timestamped captions preserve source times and clip adjacent cues', () => {
  assert.deepEqual(transcriptCues('0:05\nHello.\n0:12 Next line\n0:20 Outside.', { start: 8, end: 18 }), [
    { start: 8, end: 12, text: 'Hello.' }, { start: 12, end: 18, text: 'Next line' },
  ]);
});
test('untimed or invalid captions never invent timings', () => {
  assert.deepEqual(transcriptCues('Hello neighbour. How are you?', { start: 0, end: 40 }), []);
  assert.deepEqual(transcriptCues('0:12 A\n0:08 B', { start: 0, end: 40 }), []);
  assert.deepEqual(transcriptCues('0:78 A', { start: 0, end: 100 }), []);
});
test('hour timestamps work and saved ranges stay within the training clip', () => {
  assert.deepEqual(transcriptCues('[1:02:03] Hello', { start: 3723, end: 3730 }), [{ start: 3723, end: 3730, text: 'Hello' }]);
  assert.equal(validClipRange({ start: 8, end: 12 }, { start: 8, end: 48 }), true);
  for (const range of [{ start: 0, end: 12 }, { start: 9, end: 9 }, { start: 10, end: 49 }, { start: NaN, end: 20 }])
    assert.equal(validClipRange(range, { start: 8, end: 48 }), false);
});

test('selected phrases map to real cue boundaries across adjacent captions', async () => {
  const { rangeForText } = await import('./transcript-cues');
  const cues = [{start: 8, end:13, text:'Morning neighbour. How are you?'}, {start:13, end:16, text:'I barely slept last night.'}];
  assert.deepEqual(rangeForText('barely slept', cues), {start:13, end:16});
  assert.deepEqual(rangeForText('How are you? I barely slept', cues), {start:8, end:16});
  assert.equal(rangeForText('unrelated phrase', cues), undefined);
});

test('SRT and VTT preserve explicit cue ends and strip markup', () => {
  const srt = '1\n00:00:08,100 --> 00:00:10,200\nHello.\n\n2\n00:00:12,000 --> 00:00:15,000\n<i>Neighbour.</i>';
  assert.deepEqual(transcriptCues(srt, { start: 8, end: 14 }), [{ start: 8.1, end: 10.2, text: 'Hello.' }, { start: 12, end: 14, text: 'Neighbour.' }]);
  assert.deepEqual(transcriptCues('WEBVTT\n\n00:08.000 --> 00:12.000 align:start\nHello.', { start: 0, end: 40 }), [{ start: 8, end: 12, text: 'Hello.' }]);
});

test('default training starts with dialogue after the opening and retains forty seconds', async () => {
  const { firstSpeechRange } = await import('./transcript-cues');
  assert.deepEqual(firstSpeechRange([{start:0,end:7,text:'[Music]'}, {start:8,end:13,text:'Hello'}, {start:45,end:52,text:'Neighbour'}]), {start:8,end:48});
  assert.deepEqual(firstSpeechRange([{start:8,end:30,text:'Short clip'}]), {start:8,end:30});
  assert.equal(firstSpeechRange([]), undefined);
});
