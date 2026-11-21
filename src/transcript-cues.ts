export type ClipRange = { start: number; end: number };
export type TranscriptCue = ClipRange & { text: string };
export function validClipRange(range: ClipRange, clip: ClipRange) {
  return Number.isFinite(range.start) && Number.isFinite(range.end) &&
    range.start >= clip.start && range.end <= clip.end && range.end > range.start;
}
/** Accept explicit YouTube-style timestamp lines; never guess timing from words. */
export function transcriptCues(text: string, clip: ClipRange): TranscriptCue[] {
  if (text.includes('-->')) {
    const clock = (value: string) => value.replace(',', '.').split(':').map(Number).reduce((sum, n) => sum * 60 + n, 0);
    const blocks = text.replace(/\r/g, '').split(/\n\s*\n/);
    return blocks.flatMap(block => {
      const lines = block.split('\n');
      const i = lines.findIndex(line => line.includes('-->'));
      if (i < 0) return [];
      const timing = lines[i].match(/((?:\d+:)?\d{2}:\d{2}[.,]\d+)\s*-->\s*((?:\d+:)?\d{2}:\d{2}[.,]\d+)/);
      if (!timing) return [];
      const start = Math.max(clip.start, clock(timing[1]));
      const end = Math.min(clip.end, clock(timing[2]));
      const body = lines.slice(i + 1).join(' ').replace(/<[^>]+>/g, '').trim();
      return body && validClipRange({ start, end }, clip) ? [{ start, end, text: body }] : [];
    });
  }
  const entries: { start: number; text: string }[] = [];
  for (const line of text.split(/\r?\n/)) {
    const match = line.trim().match(/^\[?((?:\d+:)?\d{1,2}:\d{2}(?:\.\d+)?)\]?\s*(.*)$/);
    if (match) {
      const parts = match[1].split(':').map(Number);
      if (parts.slice(1).some(n => n >= 60)) return [];
      const start = parts.reduce((sum, n) => sum * 60 + n, 0);
      if (entries.length && start <= entries[entries.length - 1].start) return [];
      entries.push({ start, text: match[2] });
    } else if (entries.length && line.trim()) {
      entries[entries.length - 1].text += ` ${line.trim()}`;
    }
  }
  return entries.flatMap((entry, i) => {
    const range = { start: Math.max(clip.start, entry.start), end: Math.min(clip.end, entries[i + 1]?.start ?? clip.end) };
    return entry.text.trim() && validClipRange(range, clip)
      ? [{ ...range, text: entry.text.trim() }] : [];
  });
}

export function rangeForText(text: string, cues: TranscriptCue[]): ClipRange | undefined {
  const normalize = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const target = normalize(text);
  if (!target) return;
  let joined = '';
  const spans = cues.map(cue => {
    const offset = joined.length;
    joined += normalize(cue.text) + ' ';
    return { ...cue, offset, until: joined.length - 1 };
  });
  const at = (' ' + joined).indexOf(' ' + target + ' ');
  if (at < 0) return;
  const first = spans.find(c => c.until > at);
  const last = spans.find(c => c.until >= at + target.length);
  if (first && last) return { start: first.start, end: last.end };
}

export function firstSpeechRange(cues: TranscriptCue[], duration = 40): ClipRange | undefined {
  const spoken = cues.filter(c => c.text.trim() && !/^\s*(?:\[[^\]]+\]|\([^)]*\)|[♪♫].*)\s*$/u.test(c.text));
  if (!spoken.length) return;
  const start = Math.floor(spoken[0].start);
  const end = Math.min(start + duration, Math.floor(Math.max(...spoken.map(c => c.end))));
  return end - start >= 2 ? { start, end } : undefined;
}

/** A display-only excerpt. Keep the original captions intact for range changes.
 * Overlapping ASR durations end at the next cue's start for clip membership.
 * With no sentence punctuation, continuation is limited to three cues/eight seconds.
 * Continuation is reading context only; playable cue ranges stay inside the clip.
 */
export function transcriptExcerpt(source: TranscriptCue[], clip: ClipRange) {
  const rows = source.filter(c => c.text.trim() && Number.isFinite(c.start) && Number.isFinite(c.end) && c.start >= 0 && c.end > c.start)
    .slice().sort((a, b) => a.start - b.start);
  const selected: TranscriptCue[] = [];
  let last = -1;
  for (let i = 0; i < rows.length; i++) {
    const cue = rows[i];
    const until = Math.min(cue.end, rows[i + 1]?.start ?? cue.end);
    if (cue.start < clip.end && until > clip.start) {
      selected.push({...cue, start:Math.max(clip.start, cue.start), end:Math.min(clip.end, until)});
      last = i;
    }
  }
  let continuation = '';
  const terminal = /[.!?]["'’”\])]*\s*$/u;
  if (last >= 0 && !terminal.test(rows[last].text)) {
    let previous = rows[last];
    const parts: string[] = [];
    for (const cue of rows.slice(last + 1, last + 4)) {
      if (cue.start >= clip.end + 8 || cue.start - previous.end > 2 || /^\s*(?:\[[^\]]+\]|[♪♫].*)\s*$/u.test(cue.text)) break;
      // Stop at the first sentence ending; never include the next full sentence.
      const ending = cue.text.match(/[.!?]["'’”\])]*(?=\s|$)/u);
      parts.push(ending ? cue.text.slice(0, ending.index! + ending[0].length) : cue.text);
      if (ending) break;
      previous = cue;
    }
    continuation = parts.join('\n');
  }
  return {cues:selected, continuation, text:[...selected.map(c => c.text), continuation].filter(Boolean).join('\n')};
}
