import type { LoadedTranscript } from './transcript-loader';
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
export async function remoteTranscript(videoId: string): Promise<LoadedTranscript> {
  const url = new URL(TRANSCRIPT_ENDPOINT);
  url.searchParams.set('videoId',videoId);
  const response = await fetch(url,{signal:AbortSignal.timeout(30000),credentials:'omit',redirect:'error',referrerPolicy:'no-referrer'});
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '자막 서버에 연결하지 못했어요. 다시 시도해 주세요.');
  const transcript = validateTranscript(data);
  if (transcript.source !== `https://www.youtube.com/watch?v=${videoId}`) throw new Error('요청한 영상과 다른 자막을 받았어요. 다시 시도해 주세요.');
  return transcript;
}
