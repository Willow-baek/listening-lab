import { KNOWN_CAPTIONS } from './known-captions';
import type { TranscriptCue } from './transcript-cues';
import type { Session } from './domain';
import { remoteTranscript } from './transcript-bridge';
export function hydrateKnownTranscript(session: Session, editing = false): Session {
  if (session.phase === 'result') return session;
  const cues = session.transcriptCues?.length ? session.transcriptCues : KNOWN_CAPTIONS[session.videoId];
  if (!cues?.length) return session;
  const fillText = !editing && !session.transcript.trim();
  if (session.transcriptCues?.length && !fillText) return session;
  return {
    ...session,
    transcriptCues: cues,
    transcript: fillText ? cues.map(c => c.text).join('\n') : session.transcript,
    transcriptSource: fillText ? `https://www.youtube.com/watch?v=${session.videoId}` : session.transcriptSource,
  };
}
export type LoadedTranscript = { text: string; cues?: TranscriptCue[]; source: string; kind?: string };
const requests = new Map<string,Promise<LoadedTranscript>>();
export async function loadTranscript(videoId: string, source?: string): Promise<LoadedTranscript> {
  if (!/^[\w-]{11}$/.test(videoId)) throw new Error('올바른 YouTube 영상 링크를 입력하세요.');
  if (!source) {
    const cues = KNOWN_CAPTIONS[videoId];
    if (cues) return {text:cues.map(c=>c.text).join('\n'),cues,source:`https://www.youtube.com/watch?v=${videoId}`,kind:'youtube'};
    const saved = requests.get(videoId);
    if (saved) return saved;
    const request = (__STATIC_HOST__ ? remoteTranscript(videoId) : loadLocalTranscript(videoId)).catch(error=>{requests.delete(videoId);throw error;});
    if (requests.size >= 100) requests.delete(requests.keys().next().value!);
    requests.set(videoId,request);
    return request;
  }
  if (__STATIC_HOST__) {
    return remoteTranscript(videoId);
  }
  return loadLocalTranscript(videoId,source);
}
async function loadLocalTranscript(videoId: string, source?: string): Promise<LoadedTranscript> {
  const params = new URLSearchParams({videoId});
  if (source) params.set('source', source);
  const response = await fetch(`/__listening-lab/transcript?${params}`);
  const data = await response.json();
  if (!response.ok || !data.text) throw new Error(data.error || '스크립트를 가져오지 못했어요. 시간 자막을 직접 넣어 주세요.');
  return data;
}
