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

test('training excerpt excludes opening, other sections and overlapping ASR tails without changing original captions', async () => {
  const {transcriptExcerpt} = await import('./transcript-cues');
  const source = [
    {start:0,end:10,text:'Opening.'},
    {start:69,end:78,text:'Previous ASR line.'},
    {start:72,end:79,text:'For me the most important thing'},
    {start:76,end:82,text:'is a thoughtful answer.'},
    {start:82,end:86,text:'A completely different section.'},
  ];
  const before=JSON.stringify(source);
  const excerpt=transcriptExcerpt(source,{start:74,end:80});
  assert.equal(excerpt.text,'For me the most important thing\nis a thoughtful answer.');
  assert.deepEqual(excerpt.cues.map(c=>[c.start,c.end]),[[74,76],[76,80]]);
  assert.equal(JSON.stringify(source),before);
  assert.equal(transcriptExcerpt(source,{start:82,end:86}).text,'A completely different section.');
  assert.equal(transcriptExcerpt(source,{start:100,end:110}).text,'');
});

test('excerpt completes at most the first sentence after the boundary and never expands playback ranges', async () => {
  const {transcriptExcerpt} = await import('./transcript-cues');
  const excerpt=transcriptExcerpt([
    {start:8,end:12,text:'We need to finish'},
    {start:12,end:15,text:'the project'},
    {start:15,end:18,text:'by Friday. Another topic starts here.'},
    {start:18,end:22,text:'Do not include this.'},
  ],{start:8,end:11});
  assert.equal(excerpt.text,'We need to finish\nthe project\nby Friday.');
  assert.deepEqual(excerpt.cues,[{start:8,end:11,text:'We need to finish'}]);
  assert.equal(excerpt.continuation,'the project\nby Friday.');
});

test('unpunctuated caption continuation is bounded, and gaps, music and completed sentences stop it', async () => {
  const {transcriptExcerpt} = await import('./transcript-cues');
  const rows=Array.from({length:20},(_,i)=>({start:i*2,end:i*2+2,text:'words '+i}));
  const excerpt=transcriptExcerpt(rows,{start:0,end:3});
  assert.equal(excerpt.continuation,'words 2\nwords 3\nwords 4');
  for(const tail of [{start:10,end:12,text:'New section'}, {start:4,end:6,text:'[Music]'}]) {
    assert.equal(transcriptExcerpt([{start:0,end:4,text:'Unfinished'},tail],{start:0,end:3}).continuation,'');
  }
  assert.equal(transcriptExcerpt([{start:0,end:4,text:'Finished.'},{start:4,end:6,text:'Unrelated.'}],{start:0,end:3}).continuation,'');
});
