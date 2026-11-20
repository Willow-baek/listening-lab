import type { LoadedTranscript } from './transcript-loader';
import { captionRequestsAllowed } from './caption-policy';
// Public, read-only captions. No Sheet identifiers, credentials or learning records are sent.
export const TRANSCRIPT_ENDPOINT = 'https://listening-lab-captions.hanssollllll.chatgpt.site/captions';
export function validateTranscript(data: unknown): LoadedTranscript {
  const value = data as Partial<LoadedTranscript> | null;
  if (!value || !Array.isArray(value.cues) || !value.cues.length || value.cues.length > 20000) throw new Error('시간 자막을 읽지 못했어요. 다시 시도해 주세요.');
  const cues = value.cues.map(cue => {
    if (!cue || typeof cue.text !== 'string' || !cue.text.trim() || cue.text.length > 10000 || !Number.isFinite(cue.start) || !Number.isFinite(cue.end) || cue.start < 0 || cue.end <= cue.start) throw new Error('잘못된 시간 자막을 받았어요.');
    return {start:cue.start,end:cue.end,text:cue.text};
  }).sort((a,b) => a.start-b.start);
  return {text:cues.map(cue=>cue.text).join('\n'),cues,source:typeof value.source === 'string' && /^https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}$/.test(value.source) ? value.source : '',kind:'youtube'};
}
const CACHE_NAME = 'listening-lab.captions.v1';
const RETAIN_MS = 30 * 86400000;
async function browserCache(videoId: string) {
  if (typeof caches === 'undefined' || typeof location === 'undefined') return null;
  try { return {cache: await caches.open(CACHE_NAME), key: new URL('/__caption-cache/v1/' + videoId, location.origin).href}; }
  catch { return null; }
}
function checked(data: unknown, videoId: string) {
  const transcript = validateTranscript(data);
  if (transcript.source !== `https://www.youtube.com/watch?v=${videoId}`) throw new Error('요청한 영상과 다른 자막을 받았어요. 다시 시도해 주세요.');
  return transcript;
}
export async function remoteTranscript(videoId: string): Promise<LoadedTranscript> {
  const local = await browserCache(videoId);
  if (local) try {
    const entry = await (await local.cache.match(local.key))?.json();
    if (entry && Number.isFinite(entry.savedAt) && Date.now() >= entry.savedAt && Date.now() - entry.savedAt < RETAIN_MS) return checked(entry.value, videoId);
  } catch { /* Invalid or unavailable storage falls through to the public service. */ }
  const url = new URL(TRANSCRIPT_ENDPOINT);
  url.searchParams.set('videoId',videoId);
  const signal = AbortSignal.timeout(30000);
  let lastError = new Error('자막 서버에 연결하지 못했어요. 다시 시도해 주세요.');
  for (let attempt = 0; attempt < 3; attempt++) {
    if (!captionRequestsAllowed()) throw new Error('비용 발생 방지를 위해 자동 자막 조회를 일시 중지했어요. 시간 자막을 직접 넣어 주세요.');
    let response: Response | undefined;
    try { response = await fetch(url,{signal,credentials:'omit',redirect:'error',referrerPolicy:'no-referrer'}); }
    catch (error) { lastError = error instanceof Error ? error : lastError; }
    if (response) {
      const data = await response.json().catch(() => null);
      if (response.ok) {
        const transcript = checked(data, videoId);
        if (local) try {
          await local.cache.put(local.key, Response.json({savedAt:Date.now(),value:transcript}));
          const keys = await local.cache.keys();
          for (const key of keys.slice(0, Math.max(0, keys.length - 20))) await local.cache.delete(key);
        } catch { /* Storage restrictions must not prevent successful caption loading. */ }
        return transcript;
      }
      lastError = new Error(data?.error || '자막 서버에 연결하지 못했어요. 다시 시도해 주세요.');
      if (data?.code === 'BILLING_PAUSED' || data?.retryable === false || (response.status !== 429 && response.status < 500)) throw lastError;
    }
    if (attempt < 2 && !signal.aborted) await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
    else break;
  }
  throw lastError;
}
