import { KNOWN_CAPTIONS } from '../src/known-captions';
import { fetchYouTubeCaptions } from '../src/youtube-captions';
import { officialSource, parseOfficialTranscript } from '../src/official-transcript';
import { firstSpeechRange, type TranscriptCue } from '../src/transcript-cues';
declare const __STATIC_ASSETS__: Record<string, { body: string; type: string }>;
const cache = new Map<string, TranscriptCue[]>();
async function captions(id: string) {
  if (!/^[\w-]{11}$/.test(id)) throw new Error('올바른 영상 링크를 입력하세요.');
  const known = KNOWN_CAPTIONS[id] ?? cache.get(id);
  if (known) return known;
  const cues = await fetchYouTubeCaptions(id);
  if (cache.size >= 100) cache.clear();
  cache.set(id, cues);
  return cues;
}
function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const id = url.searchParams.get('videoId') ?? '';
    if (url.pathname === '/__listening-lab/timing') {
      if (request.method !== 'GET') return json({}, 405);
      try { return json({ range: firstSpeechRange(await captions(id)) ?? null }); }
      catch { return json({ range: null }); }
    }
    if (url.pathname === '/__listening-lab/transcript') {
      if (request.method !== 'GET') return json({}, 405);
      let captionError = '';
      if (!url.searchParams.get('source')) {
        try {
          const cues = await captions(id);
          return json({ text: cues.map(c => c.text).join('\n'), cues, source: `https://www.youtube.com/watch?v=${id}`, kind: 'youtube', coverage: 'full' });
        } catch (e) { captionError = (e as Error).message; }
      }
      try {
        let source: string;
        try { source = officialSource(id, url.searchParams.get('source') || undefined); }
        catch { throw new Error(captionError || 'ABC 공식 페이지나 시간 자막을 넣어 주세요.'); }
        const response = await fetch(source, { signal: AbortSignal.timeout(12000), redirect: 'error' });
        if (!response.ok) throw new Error('공식 원문에 연결하지 못했어요. 시간 자막을 직접 붙여넣어 주세요.');
        return json({ text: parseOfficialTranscript(await response.text()), source, kind: 'abc', timingAvailable: false, coverage: 'full' });
      } catch (e) { return json({ error: (e as Error).message }, 400); }
    }
    if (url.pathname.startsWith('/__listening-lab/')) return json({}, 404);
    if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, {status:405});
    const asset = __STATIC_ASSETS__[url.pathname] ?? (url.pathname === '/' ? __STATIC_ASSETS__['/index.html'] : undefined);
    if (!asset) return new Response('Not found', {status:404});
    const bytes = Uint8Array.from(atob(asset.body), c => c.charCodeAt(0));
    return new Response(request.method === 'HEAD' ? null : bytes, { headers: {
      'Content-Type': asset.type,
      'Cache-Control': url.pathname.startsWith('/assets/') ? 'public,max-age=31536000,immutable' : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    }});
  },
};
