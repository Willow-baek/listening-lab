import { useMemo, useRef, useState } from 'react';
import { Play, Plus, Trash2 } from 'lucide-react';
import { Help } from './Help';
import { formatTime, type Mark } from './domain';
import { transcriptCues, validClipRange, rangeForText, type TranscriptCue, type ClipRange } from './transcript-cues';

type Props = {
  transcript: string; start: number; end: number; marks: Mark[];
  onChange: (marks: Mark[]) => void;
  onPlay: (range: ClipRange) => void;
  onStop: () => void;
  looping: boolean;
  onExtend?: () => void;
  sourceCues?: TranscriptCue[];
  playbackRate?: number;
  availableRates?: number[];
  rateReady?: boolean;
  onRateChange?: (rate: number) => void;
};
export function SegmentPractice({ transcript, start, end, marks, onChange, onPlay, onStop, looping, onExtend, sourceCues, playbackRate = 1, availableRates = [1], rateReady = false, onRateChange }: Props) {
  const cues = useMemo(() => sourceCues?.length
    ? sourceCues.map(c => ({ ...c, start: Math.max(start, c.start), end: Math.min(end, c.end) })).filter(c => validClipRange(c, { start, end }))
    : transcriptCues(transcript, { start, end }), [transcript, start, end, sourceCues]);
  const [text, setText] = useState('');
  const [rangeStart, setRangeStart] = useState(String(start));
  const [rangeEnd, setRangeEnd] = useState(String(end));
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState('');
  const script = useRef<HTMLDivElement>(null);
  const editor = useRef<HTMLInputElement>(null);
  const capture = () => {
    const selected = window.getSelection();
    if (selected && script.current?.contains(selected.anchorNode) && script.current?.contains(selected.focusNode) && selected.toString().trim()) {
      const selectedText = selected.toString().trim();
      setText(selectedText);
      const range = rangeForText(selectedText, cues);
      if (range) { setRangeStart(String(range.start)); setRangeEnd(String(range.end)); }
      setEditing(null);
    }
  };
  const play = (range: ClipRange) => {
    if (!validClipRange(range, { start, end })) {
      setError('시작·종료 시간을 학습 구간 안에서 지정하세요.'); return;
    }
    setError(''); onPlay(range);
  };
  return <section className="segment-practice">
    <div className="segment-heading">
      <span>스크립트</span>
      <Help label="구간 선택과 반복">
        시간이 있는 자막은 문장을 누르면 해당 구간을 반복합니다. 시간 없는 원문은 문장을 드래그하거나 입력한 뒤 시작·종료 시간을 직접 지정하세요. 시간은 원본 영상 기준입니다.
      </Help>
      {onRateChange && <label className="practice-speed">
        속도
        <select aria-label="재생 속도" value={playbackRate} disabled={!rateReady} onChange={e => onRateChange(Number(e.target.value))}>
          {availableRates.map(rate => <option key={rate} value={rate}>{rate}×</option>)}
        </select>
      </label>}
      <div className="segment-heading-actions">
        {looping && <button className="text-button" onClick={onStop}>반복 중지</button>}
        {onExtend && <button className="quiet" onClick={onExtend}>+2분 연장</button>}
      </div>
    </div>
    {!cues.length && <form className="segment-editor" onSubmit={e => {
      e.preventDefault();
      const range = { start: Number(rangeStart), end: Number(rangeEnd) };
      if (!text.trim() || !rangeStart.trim() || !rangeEnd.trim() || !validClipRange(range, { start, end })) {
        setError('문장과 올바른 시작·종료 시간을 입력하세요.'); return;
      }
      const existing = editing ?? marks.find(m => m.text === text.trim())?.id;
      onChange(existing ? marks.map(m => m.id === existing ? { ...m, text: text.trim(), range, rangeOrigin: "manual" } : m)
        : [...marks, { id: crypto.randomUUID(), text: text.trim(), note: '', done: false, range, rangeOrigin: 'manual' }]);
      setText(''); setEditing(null); setError('');
    }}>
      <div className="segment-input-row">
      <input ref={editor} aria-label="반복할 구간 선택 또는 입력" placeholder="반복할 구간을 드래그하거나 직접 입력" value={text} onChange={e => {
        setText(e.target.value);
        const range = rangeForText(e.target.value, cues);
        if (range) { setRangeStart(String(range.start)); setRangeEnd(String(range.end)); }
      }} />
      <button className="quiet" type="submit" disabled={!text.trim()}>{editing ? '수정' : '+ 추가'}</button>
      </div>
      <div className="segment-range">
        <label>시작 (초)<input type="number" step="0.1" min={start} max={end} required value={rangeStart} onChange={e => setRangeStart(e.target.value)} /></label>
        <label>종료 (초)<input type="number" step="0.1" min={start} max={end} required value={rangeEnd} onChange={e => setRangeEnd(e.target.value)} /></label>
      </div>
    </form>}
    {cues.length ? <div className="transcript timed-transcript">
      {cues.map((cue, index) => <div className="cue-row" key={cue.start}>
        <button className="cue-play" onClick={() => { if (!window.getSelection()?.toString().trim()) play(cue); }} aria-label={`${formatTime(cue.start)} ${cue.text} 반복 재생`}>
          <span>{formatTime(cue.start)}{index === cues.length - 1 ? `–${formatTime(cue.end)}` : ''}</span><span>{cue.text}</span><Play size={14} aria-hidden="true" />
        </button>
        <button className="icon-button" aria-label={`${cue.text} 구간 저장`} onClick={() => {
          if (!marks.some(m => m.text === cue.text && m.range?.start === cue.start))
            onChange([...marks, { id: crypto.randomUUID(), text: cue.text, note: '', done: false, rangeOrigin: "caption", range: { start: cue.start, end: cue.end } }]);
        }}><Plus size={16} /></button>
      </div>)}
    </div> : <div className="transcript" ref={script} onMouseUp={capture} onTouchEnd={capture}>{transcript || 'STEP 2에서 스크립트를 입력하세요.'}</div>}
    {error && <p className="error" role="alert">{error}</p>}
    <div className="saved-segments">
      {marks.map(mark => <article key={mark.id} className={`saved-segment ${mark.done ? 'done' : ''}`}>
        <div className="saved-segment-row">
          <input type="checkbox" aria-label={`${mark.text} 이해 완료`} checked={mark.done} onChange={e => onChange(marks.map(m => m.id === mark.id ? { ...m, done: e.target.checked } : m))} />
          <button className="segment-text" onClick={() => {
            const range = mark.range ?? rangeForText(mark.text, cues);
            if (range && validClipRange(range, { start, end })) play(range);
            else if (cues.length) setError('이 문장의 시간 정보가 학습 구간에 없어요. 위 자막에서 해당 문장을 선택해 주세요.');
            else { setEditing(mark.id); setText(mark.text); setRangeStart(String(start)); setRangeEnd(String(end)); editor.current?.focus(); }
          }}>{mark.text}{mark.range && <small>{formatTime(mark.range.start)} – {formatTime(mark.range.end)}</small>}</button>
          <button className="icon-button" aria-label={`${mark.text} 삭제`} onClick={() => onChange(marks.filter(m => m.id !== mark.id))}><Trash2 size={14} /></button>
        </div>
        <div className="saved-segment-tools">
          {!cues.length && <button className="text-button" onClick={() => {
            setEditing(mark.id); setText(mark.text);
            setRangeStart(String(mark.range?.start ?? start)); setRangeEnd(String(mark.range?.end ?? end)); editor.current?.focus();
          }}>{mark.range ? '시간 수정' : '시간 지정'}</button>}
          <input aria-label={`${mark.text} 메모`} placeholder="메모" value={mark.note} onChange={e => onChange(marks.map(m => m.id === mark.id ? { ...m, note: e.target.value } : m))} />
        </div>
      </article>)}
    </div>
  </section>;
}
