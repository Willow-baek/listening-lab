import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateTranscript,remoteTranscript,TRANSCRIPT_ENDPOINT} from './transcript-bridge';
import {captionRequestsAllowed,CAPTION_PAUSE_AT} from './caption-policy';
test('automatic caption requests stop before the announced hosting charge period',()=>{
  assert.equal(captionRequestsAllowed(CAPTION_PAUSE_AT-1),true);
  assert.equal(captionRequestsAllowed(CAPTION_PAUSE_AT),false);
  assert.equal(captionRequestsAllowed(CAPTION_PAUSE_AT+1),false);
  assert.equal(captionRequestsAllowed(NaN),false);
});
test('public caption response validates real timing without synthesizing or accepting bad cues',()=>{
  const data=validateTranscript({cues:[{start:8.63,end:12.4,text:'Second.'},{start:4.91,end:8.63,text:'First.'}],source:'https://www.youtube.com/watch?v=ldwdpfIKp3o'});
  assert.equal(data.text,'First.\nSecond.');
  assert.equal(data.cues?.[0].start,4.91);
  for(const cues of [[],[{start:-1,end:1,text:'bad'}],[{start:0,end:0,text:'bad'}],[{start:1,end:2,text:''}],[{start:Infinity,end:2,text:'bad'}]]) assert.throws(()=>validateTranscript({cues}));
  assert.equal(validateTranscript({cues:[{start:0,end:1,text:'safe'}],source:'javascript:alert(1)'}).source,'');
});
test('new video lookup sends only the video ID without credentials and handles missing or mismatched captions',async()=>{
  const original=globalThis.fetch;
  const originalNow=Date.now;
  Date.now=()=>CAPTION_PAUSE_AT-1000;
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
    Date.now=()=>CAPTION_PAUSE_AT;
    await assert.rejects(()=>remoteTranscript('ldwdpfIKp3o'),/비용 발생 방지/);
    assert.equal(calls,3);
  }finally{globalThis.fetch=original;Date.now=originalNow;}
});
test('temporary limits retry, browser cache survives repeat lookup, and storage failures stay harmless',async()=>{
  const originalFetch=globalThis.fetch,originalNow=Date.now;
  const originalCaches=Object.getOwnPropertyDescriptor(globalThis,'caches');
  const originalLocation=Object.getOwnPropertyDescriptor(globalThis,'location');
  const entries=new Map<string,Response>();
  const key=(input:RequestInfo|URL)=>typeof input==='string'?input:input instanceof URL?input.href:input.url;
  const cache={match:async(input:RequestInfo|URL)=>entries.get(key(input))?.clone(),put:async(input:RequestInfo|URL,value:Response)=>{entries.set(key(input),value.clone());},keys:async()=>[...entries.keys()].map(url=>new Request(url)),delete:async(input:RequestInfo|URL)=>entries.delete(key(input))};
  Object.defineProperty(globalThis,'caches',{configurable:true,value:{open:async()=>cache}});
  Object.defineProperty(globalThis,'location',{configurable:true,value:{origin:'https://app.test'}});
  Date.now=()=>CAPTION_PAUSE_AT-60000;
  let calls=0;
  globalThis.fetch=async()=>{
    calls++;
    if(calls===1)return Response.json({code:'UPSTREAM_BLOCKED',retryable:true},{status:503});
    return Response.json({source:'https://www.youtube.com/watch?v=8EXs_cSMR1A',cues:[{start:48.32,end:51.44,text:'Good afternoon.'}]});
  };
  try{
    assert.equal((await remoteTranscript('8EXs_cSMR1A')).cues?.[0].start,48.32);
    assert.equal(calls,2);
    await remoteTranscript('8EXs_cSMR1A');assert.equal(calls,2);
    entries.clear();
    cache.put=async()=>{throw Error('quota');};
    assert.equal((await remoteTranscript('8EXs_cSMR1A')).cues?.length,1);assert.equal(calls,3);
    globalThis.fetch=async()=>{calls++;return Response.json({code:'BILLING_PAUSED',error:'Paused'},{status:503});};
    await assert.rejects(()=>remoteTranscript('8EXs_cSMR1A'),/Paused/);assert.equal(calls,4);
  }finally{
    globalThis.fetch=originalFetch;Date.now=originalNow;
    if(originalCaches)Object.defineProperty(globalThis,'caches',originalCaches);else Reflect.deleteProperty(globalThis,'caches');
    if(originalLocation)Object.defineProperty(globalThis,'location',originalLocation);else Reflect.deleteProperty(globalThis,'location');
  }
});
