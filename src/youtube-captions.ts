import { load } from 'cheerio';
import type { TranscriptCue } from './transcript-cues';

type CaptionTrack = { baseUrl: string; languageCode: string; kind?: string };
export function extractTracks(html: string): CaptionTrack[] {
  const anchor = html.indexOf('"captionTracks":');
  if (anchor < 0) return [];
  const start = html.indexOf('[', anchor);
  let depth = 0, quoted = false, escaped = false;
  for (let i = start; i < html.length && i < start + 200_000; i++) {
    const ch = html[i];
    if (quoted) { if (escaped) escaped = false; else if (ch === '\\') escaped = true; else if (ch === '"') quoted = false; continue; }
    if (ch === '"') quoted = true;
    else if (ch === '[') depth++;
    else if (ch === ']' && --depth === 0) {
      try { return JSON.parse(html.slice(start, i + 1)); } catch { return []; }
    }
  }
  return [];
}
export function json3Cues(data: unknown): TranscriptCue[] {
  const events = (data as { events?: { tStartMs?: number; dDurationMs?: number; segs?: { utf8?: string }[] }[] })?.events;
  if (!Array.isArray(events)) return [];
  return events.flatMap(event => {
    const start = Number(event.tStartMs) / 1000;
    const end = start + Number(event.dDurationMs) / 1000;
    const text = load(`<div>${(event.segs ?? []).map(s => s.utf8 ?? '').join('')}</div>`).text().replace(/\s+/g, ' ').trim();
    return text && Number.isFinite(start) && Number.isFinite(end) && end > start ? [{ start, end, text }] : [];
  });
}
export async function fetchYouTubeCaptions(videoId: string): Promise<TranscriptCue[]> {
  if (!/^[\w-]{11}$/.test(videoId)) throw new Error('올바른 유튜브 영상 링크를 입력하세요.');
  const signal = AbortSignal.timeout(10_000);
  const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, { signal, redirect: 'error' });
  if (!response.ok) throw new Error('유튜브 자막 연결 실패');
  const tracks = extractTracks(await response.text()).filter(t => /^en(?:-|$)/.test(t.languageCode));
  tracks.sort((a, b) => Number(a.kind === 'asr') - Number(b.kind === 'asr'));
  for (const track of tracks.slice(0, 2)) {
    const url = new URL(track.baseUrl);
    if (url.protocol !== 'https:' || url.hostname !== 'www.youtube.com' || url.pathname !== '/api/timedtext' || url.username || url.password || url.port) continue;
    url.searchParams.set('fmt', 'json3');
    const captions = await fetch(url, { signal, redirect: 'error' });
    if (!captions.ok) continue;
    const body = await captions.text();
    if (!body.trim()) continue;
    try { const cues = json3Cues(JSON.parse(body)); if (cues.length) return cues; } catch { /* Try the next available English track. */ }
  }
  throw new Error('시간 자막을 가져오지 못했어요. 유튜브 스크립트를 시간 표시째 붙여넣거나 자막 파일을 넣어 주세요.');
}
