import { KNOWN_CAPTIONS } from './known-captions';
import type { TranscriptCue } from './transcript-cues';
import type { Session } from './domain';
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
export async function loadTranscript(videoId: string, source?: string): Promise<LoadedTranscript> {
  if (__STATIC_HOST__) {
    const cues = KNOWN_CAPTIONS[videoId];
    if (cues && !source) return { text: cues.map(c => c.text).join('\n'), cues, source: `https://www.youtube.com/watch?v=${videoId}`, kind: 'youtube' };
    throw new Error('이 영상은 시간 표시가 있는 유튜브 스크립트를 붙여넣거나 SRT·VTT 자막 파일을 넣어 주세요.');
  }
  const params = new URLSearchParams({videoId});
  if (source) params.set('source', source);
  const response = await fetch(`/__listening-lab/transcript?${params}`);
  const data = await response.json();
  if (!response.ok || !data.text) throw new Error(data.error || '스크립트를 가져오지 못했어요. 시간 자막을 직접 넣어 주세요.');
  return data;
}
