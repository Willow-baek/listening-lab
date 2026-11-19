import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateTranscript,remoteTranscript,TRANSCRIPT_ENDPOINT} from './transcript-bridge';
test('public caption response validates real timing without synthesizing or accepting bad cues',()=>{
  const data=validateTranscript({cues:[{start:8.63,end:12.4,text:'Second.'},{start:4.91,end:8.63,text:'First.'}],source:'https://www.youtube.com/watch?v=ldwdpfIKp3o'});
  assert.equal(data.text,'First.\nSecond.');
  assert.equal(data.cues?.[0].start,4.91);
  for(const cues of [[],[{start:-1,end:1,text:'bad'}],[{start:0,end:0,text:'bad'}],[{start:1,end:2,text:''}],[{start:Infinity,end:2,text:'bad'}]]) assert.throws(()=>validateTranscript({cues}));
  assert.equal(validateTranscript({cues:[{start:0,end:1,text:'safe'}],source:'javascript:alert(1)'}).source,'');
});
test('new video lookup sends only the video ID without credentials and handles missing or mismatched captions',async()=>{
  const original=globalThis.fetch;
  const data={cues:[{start:4.91,end:8.63,text:'First.'}],source:'https://www.youtube.com/watch?v=ldwdpfIKp3o'};
  let calls=0;
  globalThis.fetch=async(input,options)=>{
    const url=new URL(String(input));
    assert.equal(url.origin+url.pathname,TRANSCRIPT_ENDPOINT);
    assert.deepEqual([...url.searchParams.entries()],[['videoId','ldwdpfIKp3o']]);
    assert.equal(options?.credentials,'omit');assert.equal(options?.referrerPolicy,'no-referrer');
    calls++;
    if(calls===2)return Response.json({error:'No public English captions.'},{status:404});
    if(calls===3)return Response.json({...data,source:'https://www.youtube.com/watch?v=abcdefghijk'});
    return Response.json(data);
  };
  try{
    assert.equal((await remoteTranscript('ldwdpfIKp3o')).cues?.[0].start,4.91);
    await assert.rejects(()=>remoteTranscript('ldwdpfIKp3o'),/No public English captions/);
    await assert.rejects(()=>remoteTranscript('ldwdpfIKp3o'),/다른 자막/);
  }finally{globalThis.fetch=original;}
});
