import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Headphones,
  ArrowRight,
  ArrowLeft,
  ArrowDown,
  Pause,
  Play,
  Check,
  Clock3,
  Hourglass,
  History,
  Plus,
  Trash2,
  ExternalLink,
  CheckCircle2,
  Volume2,
} from "lucide-react";
import {
  allocate,
  canAdvanceStage,
  canTickStage,
  wallElapsed,
  videoId,
  repetitionFinished,
  assessmentLabel,
  createSessions,
  splitRange,
  formatTime,
  instructions,
  questions,
  readStorage,
  recommend,
  RepeatTracker,
  steps,
  STORAGE,
  validAnswers,
  type Answers,
  type Session,
} from "./domain";
import { YouTube, type Player } from "./youtube";
import { Help } from "./Help";
import { firstSpeechRange, transcriptExcerpt, transcriptCues as parseCaptionText, rangeForText } from "./transcript-cues";
import { hydrateKnownTranscript, loadTranscript, type LoadedTranscript } from "./transcript-loader";
import { recordStageTime } from "./stage-time";
import { SheetsConnection } from "./SheetsConnection";
import { KNOWN_CAPTIONS } from "./known-captions";
import { SegmentPractice } from "./SegmentPractice";
function loadActive(): Session | null {
  const s = readStorage<Session | null>(STORAGE.active, null);
  if (s && s.answerVersion !== 2 && s.phase !== "result") {
    const c = s.answers?.comprehension;
    if (c !== undefined && c >= 2)
      s.answers = { ...s.answers, comprehension: c + 1 };
    s.answerVersion = 2;
  }
  return s &&
    s.plan?.length === 7 &&
    ["training", "assessment", "result"].includes(s.phase) &&
    Number.isFinite(s.elapsed)
    ? s
    : null;
}
function Stats({ session }: { session: Session }) {
  return (
    <div className="stats">
      <div>
        <Clock3 size={18} />
        <span>완료한 훈련 시간</span>
        <strong>{formatTime(session.elapsed)}</strong>
      </div>
      <div>
        <Volume2 size={18} />
        <span>실제 반복 듣기</span>
        <strong>
          {session.counts.reduce((a, b) => a + b, 0)}
          <small> / 30회</small>
        </strong>
      </div>
    </div>
  );
}
export default function App() {
  const [session, setSession] = useState<Session | null>(loadActive),
    [paused, setPaused] = useState(true),
    [history, setHistory] = useState<Session[]>(() =>
      readStorage(STORAGE.history, []),
    ),
    [view, setView] = useState<"main" | "history">("main"),
    [selected, setSelected] = useState<Session | null>(null);
  const [pending, setPending] = useState<Session[]>(() => {
    const saved = readStorage<Session[]>(STORAGE.pending, []);
    return Array.isArray(saved)
      ? saved.filter(
          (p) => p.id !== session?.id && !history.some((h) => h.id === p.id),
        )
      : [];
  });
  const [importing, setImporting] = useState(false),
    [officialUrl, setOfficialUrl] = useState(""),
    [importError, setImportError] = useState("");
  const [transcriptEditing, setTranscriptEditing] = useState(false);
  const [mode, setMode] = useState<"whole" | "split">("whole");
  useEffect(() => {
    setOfficialUrl("");
    setImportError("");
  }, [session?.id]);
  const [error, setError] = useState(""),
    [storageError, setStorageError] = useState(""),
    [peek, setPeek] = useState(false),
    [ready, setReady] = useState(false);
  const [url, setUrl] = useState(""),
    [start, setStart] = useState("0"),
    [end, setEnd] = useState("40");
  const rangeEdited = useRef(false);
  const [timingBusy, setTimingBusy] = useState(false);
  const [preparationError,setPreparationError] = useState('');
  const [preparationAttempt,setPreparationAttempt] = useState(0);
  const [preparedTranscript,setPreparedTranscript] = useState<(LoadedTranscript & {videoId:string}) | null>(null);
  useEffect(() => {
    const id = videoId(url);
    setPreparationError('');
    if (!id || session) { setTimingBusy(false); return; }
    const apply = (range: {start: number; end: number} | null | undefined) => {
      if (range && !rangeEdited.current) { setStart(String(range.start)); setEnd(String(range.end)); }
    };
    if (KNOWN_CAPTIONS[id]) { apply(firstSpeechRange(KNOWN_CAPTIONS[id])); setTimingBusy(false); return; }
    let cancelled = false;
    setPreparedTranscript(null);
    setTimingBusy(true);
    loadTranscript(id).then(data=>{
      if (cancelled) return;
      setPreparedTranscript({...data,videoId:id});
      if (data.cues?.length) apply(firstSpeechRange(data.cues));
    }).catch(error=>{if (!cancelled) setPreparationError((error as Error).message);}).finally(()=>{if (!cancelled) setTimingBusy(false);});
    return () => {cancelled = true;};
  }, [url, session?.id,preparationAttempt]);
  const [selection, setSelection] = useState(""),
    [manualStart, setManualStart] = useState(() => String(session?.start ?? 0)),
    [manualEnd, setManualEnd] = useState(() => String(session?.end ?? 10)),
    [loop, setLoop] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [availableRates, setAvailableRates] = useState<number[]>([1]);
  const player = useRef<Player | null>(null),
    state = useRef(-1),
    current = useRef(session),
    pausedRef = useRef(paused),
    tracker = useRef(new RepeatTracker()),
    loopRef = useRef({ loop, manualStart, manualEnd }),
    ended = useRef(false);
  current.current = session;
  pausedRef.current = paused;
  loopRef.current = { loop, manualStart, manualEnd };
  useEffect(() => {
    if (!ready || !session || !player.current) return;
    const rates = player.current.getAvailablePlaybackRates();
    const requested = session.step >= 5 ? session.practiceRate ?? 1 : 1;
    player.current.setPlaybackRate(rates.includes(requested) ? requested : 1);
    setPlaybackRate(player.current.getPlaybackRate());
  }, [ready, session?.step, session?.practiceRate]);
  // Stage and final-result changes should reveal the new task, even after a long form.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [session?.phase, session?.step, view, selected?.id]);
  const write = (key: string, value: unknown) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      setStorageError("");
      return true;
    } catch {
      setStorageError(
        "브라우저 저장 공간에 기록을 저장하지 못했어요. 저장 권한과 여유 공간을 확인한 뒤 다시 저장을 눌러 주세요.",
      );
      return false;
    }
  };
  useEffect(() => {
    if (!session || session.phase === "result") return;
    const prepared = hydrateKnownTranscript(session, transcriptEditing);
    const cues = prepared.transcriptCues;
    if (!cues) return;
    const marks = session.marks.map(mark => {
      if (mark.rangeOrigin === "manual") return mark;
      if (mark.range && !(mark.range.start === session.start && mark.range.end === session.end)) return mark;
      const range = rangeForText(mark.text, cues);
      return range && range.start >= session.start && range.end <= session.end
        ? { ...mark, range, rangeOrigin: "caption" as const } : mark;
    });
    if (prepared !== session || marks.some((mark, i) => mark !== session.marks[i])) {
      setSession(s => s?.id === session.id ? { ...prepared, marks } : s);
    }
  }, [session?.id, session?.transcriptCues, transcriptEditing]);
  useEffect(() => {
    if (session) write(STORAGE.active, session);
  }, [session]);
  useEffect(() => {
    write(STORAGE.pending, pending);
  }, [pending]);
  useEffect(() => {
    const pauseHidden = () => {
      if (document.hidden) {
        setPaused(true);
        player.current?.pauseVideo();
      }
    };
    document.addEventListener("visibilitychange", pauseHidden);
    return () => document.removeEventListener("visibilitychange", pauseHidden);
  }, []);
  const update = (patch: Partial<Session>) =>
    setSession((s) => (s ? { ...s, ...patch } : s));
  // Fetch new and resumed sessions as well; captions remain hidden in STEP 1.
  // A late response must never replace text the learner has already entered.
  useEffect(()=>{
    if (!session || session.phase !== 'training' || session.transcript.trim() || transcriptEditing) return;
    let cancelled = false;
    const id = session.id;
    setImporting(true);setImportError('');
    loadTranscript(session.videoId).then(data=>{
      if (!cancelled) setSession(s=>s?.id === id && !s.transcript.trim() ? {...s,transcript:data.text,transcriptCues:data.cues ?? [],transcriptSource:data.source} : s);
    }).catch(error=>{if (!cancelled) setImportError((error as Error).message);})
      .finally(()=>{if (!cancelled) setImporting(false);});
    return ()=>{cancelled = true;setImporting(false);};
  },[session?.id,transcriptEditing]);
  const advance = () => {
    const original = current.current;
    const s = original ? recordStageTime(original, Date.now()) : null;
    if (!s || s.phase !== "training" || !canAdvanceStage(s)) return;
    player.current?.pauseVideo();
    tracker.current.reset();
    state.current = 2;
    ended.current = false;
    setPeek(false);
    setLoop(false);
    if (s.step === 6) {
      setPaused(true);
      setSession({
        ...s,
        phase: "assessment",
        completedAt: new Date().toISOString(),
      });
    } else {
      const next = s.step + 1;
      setSession({
        ...s,
        step: next,
        remaining: s.remainingByStep?.[next] ?? s.plan[next],
        remainingByStep: s.plan.map((n, i) => i === s.step ? s.remaining : s.remainingByStep?.[i] ?? n),
        gapRemaining: 0,
      });
      setPaused(next === 1);
      pausedRef.current = next === 1;
      if (next !== 1 && next !== 5) {
        player.current?.seekTo(s.start, true);
        player.current?.playVideo();
      }
    }
  };
  const previous = () => {
    const original = current.current;
    const s = original ? recordStageTime(original, Date.now()) : null;
    if (!s || s.phase !== "training" || s.step === 0) return;
    player.current?.pauseVideo();
    tracker.current.reset();
    state.current = 2;
    ended.current = false;
    setPaused(true);
    pausedRef.current = true;
    setPeek(false);
    setLoop(false);
    setTranscriptEditing(false);
    setSession({
      ...s,
      step: s.step - 1,
      remaining: s.remainingByStep?.[s.step - 1] ?? s.plan[s.step - 1],
      remainingByStep: s.plan.map((n, i) => i === s.step ? s.remaining : s.remainingByStep?.[i] ?? n),
      gapRemaining: 0,
    });
  };
  const advanceRef = useRef(advance);
  advanceRef.current = advance;
  useEffect(() => {
    let last = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now(),
        dt = Math.min((now - last) / 1000, 1);
      last = now;
      const stored = current.current, p = player.current;
      if (!stored || stored.phase !== "training") return;
      const timestamp = Date.now();
      const elapsedStartedAt = stored.elapsedStartedAt ?? timestamp - stored.elapsed * 1000;
      const s = { ...recordStageTime(stored, timestamp), elapsedStartedAt, elapsed: wallElapsed(elapsedStartedAt, timestamp) };
      current.current = s;
      setSession(s);
      const repeat = s.step >= 2 && s.step <= 4;
      if (repetitionFinished(s)) return;
      if (repeat && (s.gapRemaining ?? 0) > 0) {
        if (pausedRef.current || document.hidden) return;
        const left = Math.max(0, (s.gapRemaining ?? 0) - dt);
        setSession((old) =>
          old?.id === s.id ? { ...old, gapRemaining: left } : old,
        );
        if (left === 0 && p) {
          tracker.current.reset();
          p.seekTo(s.start, true);
          p.playVideo();
        }
        return;
      }
      const playing = state.current === 1;
      if (
        !canTickStage(s, {
          paused: pausedRef.current,
          hidden: document.hidden,
          playerAvailable: Boolean(p),
          playing,
          ended: ended.current,
        })
      )
        return;
      const time = p?.getCurrentTime() ?? s.start;
      const atEnd = ended.current;
      ended.current = false;
      const done =
        repeat &&
        tracker.current.sample(
          atEnd ? s.end : time,
          playing || atEnd,
          s.start,
          s.end,
          dt,
        );
      setSession((old) =>
        old && old.id === s.id && old.phase === "training"
          ? {
              ...old,
              remaining: Math.max(0, old.remaining - dt),
            }
          : old,
      );
      if (p && repeat && (done || time >= s.end || atEnd)) {
        tracker.current.reset();
        p.pauseVideo();
        state.current = 2;
        if (done) {
          const counts = [...s.counts];
          counts[s.step - 2]++;
          const next = {
            ...s,
            remaining: Math.max(0, s.remaining - dt),
            counts,
          };
          current.current = next;
          setSession(next);
          if (counts[s.step - 2] >= 10) {
            setPaused(true);
            setSession({ ...next, gapRemaining: 0 });
            return;
          }
          const gap = s.gapSeconds ?? 3;
          if (gap > 0) {
            setSession({ ...next, gapRemaining: gap });
            return;
          }
        }
        p.seekTo(s.start, true);
        p.playVideo();
      } else if (p && !repeat && (playing || atEnd)) {
        const bounds = loopRef.current;
        const a = bounds.loop ? Number(bounds.manualStart) : s.start,
          b = bounds.loop ? Number(bounds.manualEnd) : s.end;
        if (time >= b || time < a - 0.4) {
          p.seekTo(a, true);
          p.playVideo();
        }
      }
      if (!repeat && s.remaining <= dt) {
        current.current = { ...s, remaining: 0 };
        if (s.step === 5) {
          setPaused(true);
          setSession(current.current);
          p?.pauseVideo();
        } else advanceRef.current();
      }
    }, 250);
    return () => clearInterval(timer);
  }, []);
  function startSession(e: FormEvent) {
    e.preventDefault();
    setError("");
    const a = Number(start),
      b = Number(end);
    try {
      const sessions = createSessions(
        url,
        a,
        b,
        mode === "split" && b - a > 40,
      );
      const s = hydrateKnownTranscript(sessions[0]);
      if (preparedTranscript?.videoId === s.videoId) {
        s.transcript = preparedTranscript.text;
        s.transcriptCues = preparedTranscript.cues;
        s.transcriptSource = preparedTranscript.source;
      }
      // Save the first active session before the queue, so both survive a refresh.
      write(STORAGE.active, s);
      setPending(sessions.slice(1));
      setSession(s);
      setPaused(true);
      setReady(false);
      setManualStart(String(a));
      setManualEnd(String(b));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function startPending() {
    const next = pending[0];
    if (!next) return;
    player.current?.pauseVideo();
    write(STORAGE.active, next);
    setSession(next);
    setPending(pending.slice(1));
    setPaused(true);
    setReady(false);
    setSelected(null);
    setView("main");
    setManualStart(String(next.start));
    setManualEnd(String(next.end));
    setError("");
    setPeek(false);
    setLoop(false);
    tracker.current.reset();
  }
  function togglePause() {
    if (!session || repetitionFinished(session)) return;
    const study = session.step === 1 || session.step === 5;
    if (session.step === 1 && !session.transcript.trim()) return;
    if (!study && !ready) return;
    if (paused) {
      setError("");
      const p = player.current;
      if (study) p?.pauseVideo();
      else if (
        p &&
        !(
          session.step >= 2 &&
          session.step <= 4 &&
          (session.gapRemaining ?? 0) > 0
        )
      ) {
        const t = p.getCurrentTime();
        if (t < session.start || t >= session.end) {
          tracker.current.reset();
          p.seekTo(session.start, true);
        }
        p.playVideo();
      }
      setPaused(false);
    } else {
      setPaused(true);
      player.current?.pauseVideo();
    }
  }
  function applyCaptionText(raw: string, requireTiming = false) {
    if (!session) return;
    const cues = parseCaptionText(raw, { start: session.start, end: session.end });
    if (requireTiming && !cues.length) {
      setImportError("학습 구간에 해당하는 시간 자막이 없어요. 원본 영상 시간과 선택한 구간을 확인하세요."); return;
    }
    update({ transcript: cues.length ? cues.map(c => c.text).join("\n") : raw, transcriptCues: cues.length ? cues : session.transcriptCues, transcriptSource: cues.length ? undefined : session.transcriptSource });
    setImportError(""); setTranscriptEditing(false);
  }
  async function importTranscript() {
    if (!session || session.step !== 1) return;
    setImporting(true);
    setImportError("");
    const sessionId = session.id;
    try {
      const data = await loadTranscript(session.videoId, officialUrl.trim() || undefined);
      setSession((s) =>
        s?.id === sessionId && s.step === 1 && !s.transcript.trim()
          ? { ...s, transcript: data.text, transcriptSource: data.source, transcriptCues: data.cues ?? [] }
          : s,
      );
    } catch (e) {
      setImportError((e as Error).message);
    } finally {
      setImporting(false);
    }
  }
  function finish(e: FormEvent) {
    e.preventDefault();
    if (!session || !validAnswers(session.answers)) {
      setError("다섯 가지 자기평가에 모두 응답해 주세요.");
      return;
    }
    const result: Session = {
      ...session,
      phase: "result",
      recommendation: recommend(session.answers as Answers),
    };
    const records = [result, ...history.filter((h) => h.id !== result.id)];
    write(STORAGE.history, records);
    setHistory(records);
    setSession(result);
    setError("");
  }
  function nextSession() {
    player.current?.pauseVideo();
    try {
      localStorage.removeItem(STORAGE.active);
    } catch {
      setStorageError(
        "이전 세션 초안을 지우지 못했어요. 브라우저 저장 권한을 확인해 주세요.",
      );
    }
    setSession(null);
    setPaused(true);
    setReady(false);
    setSelected(null);
    setView("main");
    setUrl("");
    setStart("0");
    setEnd("40");
    setMode("whole");
    setError("");
    setPeek(false);
    setLoop(false);
    tracker.current.reset();
  }
  const excerpt = session?.transcriptCues?.length
    ? transcriptExcerpt(session.transcriptCues, session)
    : null;
  const displayedTranscript = excerpt ? excerpt.text : session?.transcript ?? '';
  const shown = selected ?? session;
  const result = shown?.phase === "result" ? shown : null;
  const training = session?.phase === "training" && view === "main";
  const total = session ? session.counts.reduce((a, b) => a + b, 0) : 0;
  const waitingForTranscript =
    session?.step === 1 && !session.transcript.trim();
  const studyStage = session?.step === 1 || session?.step === 5;
  useEffect(() => {
    if (waitingForTranscript) setPaused(true);
  }, [waitingForTranscript]);
  const duration = Number(end) - Number(start);
  let wholePlan: number[] | null = null,
    partPlans: number[][] = [];
  let ranges: [number, number][] = [];
  try {
    if (
      !Number.isSafeInteger(Number(start)) ||
      !Number.isSafeInteger(Number(end)) ||
      Number(start) < 0
    )
      throw new Error();
    wholePlan = allocate(duration);
    if (duration > 40) {
      ranges = splitRange(Number(start), Number(end));
      partPlans = ranges.map(([a, b]) => allocate(b - a));
    }
  } catch {}
  const splitting = mode === "split" && duration > 40 && partPlans.length === 2;
  const plan = splitting ? partPlans[0] : wholePlan;
  const sum = (p: number[]) => p.reduce((a, b) => a + b, 0);
  const minutes = (p: number[]) => Math.ceil(sum(p) / 60);
  return (
    <div className="app">
      <header>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setView("main");
            setSelected(null);
          }}
        >
          <span className="brand-icon">
            <Headphones size={22} />
          </span>
          Listening Lab
        </a>
        <button
          className="quiet"
          onClick={() => {
            setView(view === "history" ? "main" : "history");
            setSelected(null);
            if (training) {
              setPaused(true);
              player.current?.pauseVideo();
            }
          }}
        >
          <History size={17} />
          {view === "history"
            ? "돌아가기"
            : `학습 기록${history.length ? ` (${history.length})` : ""}`}
        </button>
      </header>
      {storageError && (
        <div className="alert" role="alert">
          {storageError}
          <button
            className="text-button"
            onClick={() => {
              if (session) write(STORAGE.active, session);
              write(STORAGE.history, history);
            }}
          >
            다시 저장
          </button>
        </div>
      )}
      <main>
        <div hidden={view !== "history" || Boolean(selected)}>
          <SheetsConnection session={session} history={history} />
        </div>
        {view === "history" && !selected ? (
          <>
            <div className="page-heading">
              <h1>차곡차곡, 듣기의 기록.</h1>
              <p>한 번의 훈련보다, 이어지는 변화에 주목하세요.</p>
            </div>
            {history.length === 0 ? (
              <div className="empty">
                <History size={32} />
                <h2>첫 번째 기록을 기다리고 있어요.</h2>
                <p>7단계 훈련과 최종 평가를 마치면 여기에 보관됩니다.</p>
              </div>
            ) : (
              <div className="history-list">
                {history.map((h) => (
                  <button key={h.id} onClick={() => setSelected(h)}>
                    <span>
                      {new Date(h.completedAt ?? "").toLocaleDateString(
                        "ko-KR",
                      )}
                      <small>
                        {h.series
                          ? `구간 ${h.series.index}/${h.series.total} · `
                          : ""}
                        {formatTime(h.elapsed)} ·{" "}
                        {h.counts.reduce((a, b) => a + b, 0)}회 반복
                      </small>
                    </span>
                    <strong>{h.recommendation?.level}</strong>
                    <ArrowRight size={20} />
                  </button>
                ))}
              </div>
            )}
            <button className="quiet" onClick={() => setView("main")}>
              <ArrowLeft size={16} />
              현재 세션으로
            </button>
          </>
        ) : result ? (
          <div className="result-screen">
            <div className="completion">
              <CheckCircle2 size={30} />
              <span>
                7단계 훈련 완료
                {result.series
                  ? ` · 구간 ${result.series.index} / ${result.series.total}`
                  : ""}
              </span>
            </div>
            <Stats session={result} />
            <section
              className={`recommendation ${result.recommendation!.level.toLowerCase().replace(" ", "-")}`}
              aria-labelledby="recommendation-title"
            >
              <div className="recommendation-symbol">
                <Headphones size={34} />
              </div>
              <div>
                <p>다음 자료의 추천 난이도</p>
                <h2 id="recommendation-title">
                  {result.recommendation!.level}
                </h2>
                <p className="level-caption">
                  {result.recommendation!.level === "LEVEL UP"
                    ? "조금 더 어려운 자료에 도전해 보세요."
                    : result.recommendation!.level === "LEVEL DOWN"
                      ? "조금 더 쉬운 자료로 연결을 만들어 보세요."
                      : "비슷한 난이도로 한 번 더 이어가세요."}
                </p>
              </div>
            </section>
            <section className="result-detail">
              <h2>이렇게 추천한 이유</h2>
              <ul>
                {result.recommendation!.reasons.map((r) => (
                  <li key={r}>
                    <Check size={16} />
                    {r}
                  </li>
                ))}
              </ul>
              <h3>다음 학습 자료 선택 가이드</h3>
              <p>{result.recommendation!.guide}</p>
              <div className="compact-disclaimer">
                자기평가 기반 가이드 · 객관적인 영어 능력 평가 아님
                <Help label="추천의 의미">
                  이 추천은 다음 학습 자료를 선택하기 위한 가이드입니다. 앱은 AI
                  자료 추천이나 자동 정확도 점수를 제공하지 않습니다.
                </Help>
              </div>
            </section>
            <details className="responses">
              <summary>나의 자기평가 응답 보기</summary>
              {questions.map((q) => (
                <p key={q.key}>
                  <strong>{q.title}</strong>
                  <br />
                  {assessmentLabel(result, q.key)}
                </p>
              ))}
            </details>
            <div className="result-actions">
              {selected ? (
                <button className="primary" onClick={() => setSelected(null)}>
                  <ArrowLeft size={17} />
                  기록 목록으로
                </button>
              ) : (
                <button
                  className="primary"
                  onClick={pending.length ? startPending : nextSession}
                >
                  {pending.length
                    ? `다음 구간 시작 · ${pending[0].series?.index} / ${pending[0].series?.total}`
                    : "START NEXT SESSION"}
                  <ArrowRight size={18} />
                </button>
              )}
              {pending.length > 0 && !selected && (
                <button className="quiet" onClick={nextSession}>
                  새 자료로 시작
                </button>
              )}
              <Help label="다음 세션 시작">
                다음 자료는 이 난이도를 참고해 ChatGPT에서 선택한 뒤 새 YouTube
                링크를 가져오세요. 대기 중인 구간이 있으면 다음 구간을 바로
                시작할 수 있습니다. 새 자료로 시작해도 대기 중인 구간은 시작
                화면에 남습니다. 이전 결과는 학습 기록에 보존됩니다.
              </Help>
            </div>
          </div>
        ) : session?.phase === "assessment" ? (
          <div className="assessment">
            <div className="completion">
              <CheckCircle2 size={24} />
              <span>7단계 훈련 완료 · 최종 평가</span>
            </div>
            <h1>이제, 어떻게 들리나요?</h1>
            <p className="intro">
              정답은 없어요. 실제 소리가 얼마나 또렷해졌는지 돌아보세요.
              <br />이 평가는 새로운 훈련 단계가 아닙니다.
            </p>
            <Stats session={session} />
            <form onSubmit={finish}>
              <section className="section">
                <h2 className="with-help">
                  오늘의 듣기를 돌아보기
                  <Help label="자기평가">
                    모든 질문에 하나씩 선택해 주세요. 정답은 없어요. 처음과 반복
                    후 실제 소리가 얼마나 정확하게 들렸는지 돌아보세요.
                  </Help>
                </h2>
                {total < 30 && (
                  <p className="notice">
                    기록된 반복은 {total}회입니다. 실제 완료한 훈련을 기준으로
                    답해 주세요.
                  </p>
                )}
                {questions.map((q, i) => (
                  <fieldset key={q.key}>
                    <legend>
                      <span>{i + 1}</span>
                      {q.title}
                      {q.key === "comprehension" && (
                        <Help label="스크립트 이해도 기준">
                          비율은 스스로 느낀 대략적인 이해 정도를 고르는
                          기준입니다. 자동으로 계산한 점수가 아닙니다.
                        </Help>
                      )}
                    </legend>
                    <div className="choices">
                      {q.options.map((option, index) => (
                        <label
                          key={option}
                          className={
                            session.answers[q.key] === index ? "chosen" : ""
                          }
                        >
                          <input
                            type="radio"
                            name={q.key}
                            value={index}
                            checked={session.answers[q.key] === index}
                            required
                            onChange={() =>
                              update({
                                answers: { ...session.answers, [q.key]: index },
                              })
                            }
                          />
                          <span>{option}</span>
                          {session.answers[q.key] === index && (
                            <Check size={16} />
                          )}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ))}
              </section>
              <div className="compact-disclaimer">
                자기평가 기반 추천
                <Help label="난이도 추천 기준">
                  스크립트 이해도, 반복 후 인식 정도, 남은 어려움, 체감 난이도를
                  명시적인 규칙으로 함께 판단합니다. 첫 듣기의 어려움만으로
                  LEVEL DOWN을 추천하지 않으며, 판단이 애매하면 KEEP LEVEL을
                  안내합니다. 객관적인 영어 능력 평가는 아닙니다.
                </Help>
              </div>
              <button className="primary" type="submit">
                나의 다음 난이도 확인하기
                <ArrowRight size={18} />
              </button>
            </form>
          </div>
        ) : !session ? (
          <div className="setup">
            {pending.length > 0 && (
              <section className="pending-session" aria-label="이어갈 구간">
                <div>
                  <strong>
                    이어갈 구간 {pending[0].series?.index} /{" "}
                    {pending[0].series?.total}
                  </strong>
                  <p>
                    {formatTime(pending[0].start)} —{" "}
                    {formatTime(pending[0].end)} · 약 {minutes(pending[0].plan)}
                    분
                  </p>
                </div>
                <button className="quiet" onClick={startPending}>
                  이어서 시작
                  <ArrowRight size={16} />
                </button>
              </section>
            )}
            <section className="setup-form">
              <h1 className="with-help">
                새 세션
                <Help label="훈련 준비">
                  <p>
                    지금은 YouTube 링크와 구간만 준비하세요. 스크립트는 STEP 1
                    기록을 마친 뒤 STEP 2에서 처음 붙여넣습니다.
                  </p>
                  <p>
                    첫 듣기를 마칠 때까지 원문을 보지 않아야 소리 인식의 변화를
                    비교할 수 있어요. 자료는 ChatGPT에서 선택한 뒤 가져오세요.
                  </p>
                </Help>
              </h1>
              <form onSubmit={startSession}>
                <label className="field">
                  YouTube 링크
                  <input
                    type="url"
                    required
                    placeholder="https://www.youtube.com/watch?v=…"
                    value={url}
                    onChange={(e) => { rangeEdited.current = false; setUrl(e.target.value); setStart("0"); setEnd("40"); }}
                  />
                </label>
                <div className="time-inputs">
                  <label className="field">
                    시작 시간 (초)
                    <input
                      type="number"
                      min="0"
                      step="1"
                      required
                      value={start}
                      onChange={(e) => { rangeEdited.current = true; setStart(e.target.value); }}
                    />
                  </label>
                  <label className="field">
                    종료 시간 (초)
                    <input
                      type="number"
                      min="2"
                      step="1"
                      required
                      value={end}
                      onChange={(e) => { rangeEdited.current = true; setEnd(e.target.value); }}
                    />
                  </label>
                </div>
                {wholePlan && duration > 40 && (
                  <fieldset className="session-mode">
                    <legend className="with-help">
                      진행 방식
                      <Help label="전체 훈련과 나누기">
                        각 세션은 동일한 7단계와 30회 반복을 진행합니다. 구간을
                        나누면 한 번의 부담은 줄지만, 각 세션에 공부·쉐도잉
                        시간이 따로 배정되어 총시간은 늘어납니다.
                      </Help>
                    </legend>
                    <div className="choices">
                      <label className={mode === "whole" ? "chosen" : ""}>
                        <input
                          type="radio"
                          name="session-mode"
                          value="whole"
                          checked={mode === "whole"}
                          onChange={() => setMode("whole")}
                        />
                        <span>
                          전체 구간 <strong>약 {minutes(wholePlan)}분</strong>
                        </span>
                      </label>
                      <label className={mode === "split" ? "chosen" : ""}>
                        <input
                          type="radio"
                          name="session-mode"
                          value="split"
                          checked={mode === "split"}
                          onChange={() => setMode("split")}
                        />
                        <span>
                          두 세션으로 나누기{" "}
                          <strong>
                            {partPlans
                              .map((p) => `약 ${minutes(p)}분`)
                              .join(" + ")}
                          </strong>
                        </span>
                      </label>
                    </div>
                  </fieldset>
                )}
                {plan ? (
                  <div className="allocation">
                    <div>
                      <span className="with-help">
                        예상 훈련 시간
                        <Help label="학습 구간과 시간 배분">
                          <p>
                            최소 2초 구간부터 선택할 수 있어요. 전체 시간을 최소
                            60분으로 배분하며, 40초를 넘으면 다른 네 단계의 총
                            40분을 유지한 채 반복 시간을 추가합니다.
                          </p>
                          <p>
                            표시 시간은 일시정지·버퍼링·단계 연장·최종 평가 작성
                            시간을 제외한 계획입니다.
                          </p>
                        </Help>
                      </span>
                      <strong>
                        {splitting
                          ? `두 세션 총 약 ${partPlans.reduce((n, p) => n + minutes(p), 0)}분`
                          : `약 ${minutes(plan)}분`}
                      </strong>
                    </div>
                    {duration > 40 && (
                      <p className="duration-notice" role="status">
                        {splitting
                          ? `구간마다 7단계 · 30회 반복을 진행합니다.`
                          : `60분보다 약 ${Math.ceil((sum(plan) - 3600) / 60)}분 늘어납니다.`}
                      </p>
                    )}
                    {splitting && (
                      <ol className="split-preview">
                        {ranges.map(([a, b], i) => (
                          <li key={i}>
                            <span>
                              구간 {i + 1} · {formatTime(a)} — {formatTime(b)}
                            </span>
                            <strong>약 {minutes(partPlans[i])}분</strong>
                          </li>
                        ))}
                      </ol>
                    )}
                    <div className="allocation-bar">
                      {plan.map((n, i) => (
                        <span
                          key={i}
                          style={{ flex: n }}
                          title={`STEP ${i + 1} ${formatTime(n)}`}
                        />
                      ))}
                    </div>
                    <p>
                      {splitting ? "첫 세션 · " : ""}30회 반복{" "}
                      {formatTime(plan[2] * 3)} · 나머지 네 단계{" "}
                      {formatTime(sum(plan) - plan[2] * 3)}
                    </p>
                    <details>
                      <summary>
                        {splitting ? "세션별" : "단계별"} 시간 보기
                      </summary>
                      {(splitting ? partPlans : [plan]).map((part, j) => (
                        <div key={j}>
                          {splitting && <h3>구간 {j + 1}</h3>}
                          {part.map((n, i) => (
                            <div className="plan-row" key={i}>
                              <span>
                                STEP {i + 1} · {steps[i]}
                              </span>
                              <span>{formatTime(n)}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </details>
                  </div>
                ) : (
                  <p className="notice">
                    시작·종료 시간을 확인해 주세요. 최소 2초 이상의 구간이
                    필요합니다.
                  </p>
                )}
                {pending.length > 0 && (
                  <p className="notice">
                    새 훈련을 시작하면 대기 중인 구간은 새 계획으로 교체됩니다.
                    완료한 기록은 보존됩니다.
                  </p>
                )}
                {error && (
                  <p role="alert" className="error">
                    {error}
                  </p>
                )}
                {preparationError && <div className="error" role="alert">{preparationError} <button type="button" className="text-button" onClick={()=>setPreparationAttempt(n=>n+1)}>다시 시도</button></div>}
                <button className="primary wide" type="submit" disabled={timingBusy}>
                  {timingBusy ? "시작 구간 확인 중…" : "START SESSION"}
                  <ArrowRight size={18} />
                </button>
              </form>
            </section>
          </div>
        ) : null}
        {/* Keep the official player mounted while temporarily browsing history. */}
        {session?.phase === "training" && (
          <div
            className="training"
            style={{ display: training ? undefined : "none" }}
          >
            <div className="training-progress">
              <ol aria-label="훈련 단계">
                {steps.map((name, i) => (
                  <li key={name + i}
                    className={i === session.step ? "active" : i < session.step ? "complete" : ""}
                    aria-current={i === session.step ? "step" : undefined}
                    aria-label={`${i + 1}. ${name}`}
                  >
                    <Help label={`STEP ${i + 1} · ${name}`} className="stage-number" trigger={i + 1}>
                      <strong>{name}</strong>
                      <p>{instructions[i]}</p>
                      {i === 0 && <p>스크립트는 STEP 2에서 처음 가져옵니다. 소리에 집중하려면 화면에서 시선을 잠시 돌려 보세요.</p>}
                    </Help>
                    {i < steps.length - 1 && (
                      <span className="stage-connector" aria-hidden="true">
                        <span style={{ width: `${i < session.step ? 100 : i === session.step ? Math.max(0, Math.min(100, (1 - session.remaining / session.plan[i]) * 100)) : 0}%` }} />
                      </span>
                    )}
                  </li>
                ))}
              </ol>
              <span className="training-elapsed" aria-label={`전체 훈련 경과 시간 ${formatTime(session.elapsed)}`}>
                <Clock3 size={14} aria-hidden="true" />
                <span>전체 {formatTime(session.elapsed)}</span>
              </span>
            </div>
            <div className="training-content">
              <div className="training-title">
                <div className="with-help">
                  <h1>{steps[session.step]}</h1>
                </div>
                {session.series && <span>구간 {session.series.index}/{session.series.total}</span>}
              </div>
              {session.step !== 0 && (
                <p className="intro">
                  {
                    [
                      "",
                      "원문의 의미를 충분히 이해하세요.",
                      "스크립트 없이 소리에 집중해서 열 번 들어 보세요.",
                      "열 번 더 들어 보세요. 안 들리는 부분은 스크립트를 잠시 확인하세요.",
                      "스크립트 없이 소리에 집중해서 열 번 들어 보세요.",
                      "아직 들리지 않는 표현을 확인하세요.",
                      "원어민의 리듬과 강세를 따라 말하세요.",
                    ][session.step]
                  }
                </p>
              )}
              <div
                className={`timer-row ${session.step >= 2 && session.step <= 4 ? "listening-focus" : ""}`}
              >
                {session.step >= 2 && session.step <= 4 && (repetitionFinished(session) || (session.gapRemaining ?? 0) > 0) && (
                  <div className="focus-status" role="status">
                    {repetitionFinished(session)
                      ? "10회 반복 완료 · 다음 단계로 이동할 준비가 됐어요."
                      : `잠시 쉬어가기 · ${Math.ceil(session.gapRemaining!)}초 뒤 다음 재생`}
                  </div>
                )}
                <div className="stage-countdown" role="timer" aria-label="현재 단계 남은 시간">
                  <Hourglass size={24} strokeWidth={1.5} aria-hidden="true" />
                  <strong>{formatTime(session.remaining)}</strong>
                </div>
                {session.step >= 2 && session.step <= 4 && (
                  <div className="repeat-count">
                    <span>이번 단계 반복</span>
                    <strong>
                      {session.counts[session.step - 2]}
                      <small> / 10</small>
                    </strong>
                  </div>
                )}
                <button
                  className="primary"
                  disabled={
                    waitingForTranscript ||
                    (!studyStage && !ready && !repetitionFinished(session))
                  }
                  onClick={repetitionFinished(session) ? advance : togglePause}
                >
                  {repetitionFinished(session) ? (
                    <ArrowRight size={18} />
                  ) : paused ? (
                    <Play size={18} />
                  ) : (
                    <Pause size={18} />
                  )}
                  {repetitionFinished(session)
                    ? "NEXT"
                    : paused
                      ? "PLAY"
                      : "PAUSE"}
                </button>
              </div>
              {session.step >= 2 && session.step <= 4 && (
                <div className="repeat-settings">
                  <div className="repeat-settings-left">
                  <label>
                    간격
                    <select
                      value={session.gapSeconds ?? 3}
                      onChange={(e) =>
                        update({ gapSeconds: Number(e.target.value) })
                      }
                    >
                      <option value={0}>없음</option>
                      <option value={2}>2초</option>
                      <option value={3}>3초</option>
                      <option value={5}>5초</option>
                    </select>
                  </label>

                  <Help label="반복 간격">
                    한 번 재생한 뒤 선택한 시간만큼 쉬고 다음 재생을 시작합니다.
                    휴식은 반복 횟수와 공부 시간에 포함되지 않습니다. 10회 완료
                    후에는 직접 다음 단계를 눌러 주세요.
                  </Help>
                  </div>
              {session.step === 3 && (
                <button className="quiet script-peek-toggle" aria-expanded={peek} aria-controls={peek ? "transcript-panel" : undefined} onClick={() => setPeek(!peek)}>
                  {peek ? "스크립트 닫기" : "스크립트 열기"}
                </button>
              )}
                <button
                  className="quiet"
                  onClick={() =>
                    update({
                      remaining: session.remaining + 120,
                      plan: session.plan.map((n, i) =>
                        i === session.step ? n + 120 : n,
                      ),
                    })
                  }
                >
                  +2분 연장
                </button>
                </div>
              )}
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              {waitingForTranscript && (
                <p className="notice" role="status">
                  스크립트를 붙여넣은 뒤 PLAY를 누르세요.
                </p>
              )}
              {session.step === 0 && (
                <div className="field note-field">
                  <textarea
                    aria-label="STEP 1 듣기 메모"
                    rows={10}
                    value={session.before}
                    onChange={(e) => update({ before: e.target.value })}
                    placeholder={
                      "STEP 1. 먼저 적으려 하지 말고, 소리에 집중해 한 번 들어보세요.\n\n들은 뒤 PAUSE를 누르고, 기억나는 문장이나 단어를 들린 그대로 적어보세요. 추측한 부분은 (추측)으로 구분하세요.\n\n필요하면 PLAY로 다시 들을 수 있어요. 스크립트는 아직 보지 않습니다."
                    }
                  />
                </div>
              )}
              {(session.step === 1 || peek) && (
                <section className="transcript-section" id="transcript-panel">
                  <div className="transcript-toolbar">
                    {session.step === 1 && (
                      <form
                        className="add-expression"
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (selection.trim()) {
                            update({
                              marks: [
                                ...session.marks,
                                {
                                  id: crypto.randomUUID(),
                                  text: selection.trim(),
                                  note: "",
                                  done: false,
                                },
                              ],
                            });
                            setSelection("");
                          }
                        }}
                      >
                        <input
                          aria-label="이해가 안 되는 구간을 드래그하거나 직접 입력"
                          value={selection}
                          onChange={(e) => setSelection(e.target.value)}
                          placeholder="이해가 안 되는 구간을 드래그하거나 직접 입력"
                        />
                        <button
                          className="quiet"
                          type="submit"
                          disabled={!selection.trim()}
                        >
                          <Plus size={16} />
                          추가
                        </button>
                      </form>
                    )}
                    {session.step === 1 && (
                    <Help label="스크립트와 표현 표시">
                      <p>
                        STEP 1의 최초 듣기 기록은 저장되어 있어요. STEP 2에서
                        원문을 붙여넣고 의미를 충분히 이해하세요. 입력 전에는
                        타이머가 기다립니다.
                      </p>
                      <p>
                        어려운 표현은 텍스트를 드래그한 뒤 표시하세요. 터치
                        기기에서는 위 입력창으로 직접 추가할 수 있어요.
                      </p>
                    </Help>
                    )}
                  {session.step === 1 && session.transcript.trim() && (
                    <button className="text-button transcript-edit-toggle" onClick={() => transcriptEditing ? applyCaptionText(session.transcript) : setTranscriptEditing(true)}>
                      {transcriptEditing ? "편집 완료" : "편집"}
                    </button>
                  )}
                  </div>
                  {session.step === 1 && (!session.transcript.trim() || transcriptEditing) && (
                    <div className="transcript-editor">
                      {!session.transcript.trim() && <div className="transcript-import">
                        <button
                          className="quiet"
                          disabled={
                            importing || Boolean(session.transcript.trim())
                          }
                          onClick={importTranscript}
                        >
                          {importing
                            ? "자막 가져오는 중…"
                            : "스크립트 가져오기"}
                        </button>
                        <Help label="스크립트 가져오기">
                          YouTube에 공개된 영어 자막과 시간을 자동으로 가져옵니다. STEP 1에서는 스크립트를 숨기고 STEP 2부터 보여 줍니다. 자막이 없거나 YouTube가 요청을 제한하면 다시 시도하거나 시간 자막을 직접 넣을 수 있어요.
                        </Help>
                      </div>}
                      {!__STATIC_HOST__ && !session.transcript.trim() && (
                        <details className="official-source">
                          <summary>다른 ABC 공식 자료 링크 입력</summary>
                          <input
                            aria-label="ABC 공식 스크립트 페이지"
                            type="url"
                            value={officialUrl}
                            onChange={(e) => setOfficialUrl(e.target.value)}
                            placeholder="https://www.abc.net.au/education/learn-english/…"
                          />
                        </details>
                      )}
                      {importError && (
                        <p className="error" role="alert">
                          {importError}
                        </p>
                      )}
                      {session.transcriptSource && (
                        <p className="source-note">
                          <a
                            href={session.transcriptSource}
                            target="_blank"
                            rel="noopener"
                          >
                            원문 출처
                          </a>{" "}
                          {!session.transcriptCues?.length && <span>· 시간 없음</span>}
                          <Help label="원문 정보">{session.transcriptCues?.length ? "시간 자막이 함께 저장되어 있습니다. STEP 6에서 문장을 눌러 반복할 수 있어요." : "시간 없는 전체 원문입니다. 시간 자막을 따로 넣거나 STEP 6에서 시간을 지정하세요."}</Help>
                        </p>
                      )}
                      <label className="caption-file-button">
                        자막 파일 넣기
                        <input type="file" accept=".srt,.vtt,.txt" onChange={async e => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 2_000_000) { setImportError("2MB 이하 자막 파일을 넣어 주세요."); return; }
                          try { applyCaptionText(await file.text(), true); } catch { setImportError("파일을 읽지 못했어요."); }
                          e.target.value = "";
                        }} />
                      </label>
                      <label className="field">
                        <textarea
                          aria-label="스크립트 붙여넣기"
                          rows={3}
                          onFocus={() => setTranscriptEditing(true)}
                          value={session.transcript}
                          onChange={(e) =>
                            update({ transcript: e.target.value })
                          }
                          placeholder="유튜브 스크립트를 시간 표시째 붙여넣으세요. 시간은 편집 완료 후 숨겨집니다."
                        />
                      </label>
                    </div>
                  )}
                  {session.transcript.trim() && !(session.step === 1 && transcriptEditing) && (
                    <div
                      className="transcript"
                      onMouseUp={() =>
                        setSelection(
                          window.getSelection()?.toString().trim() ?? "",
                        )
                      }
                      onTouchEnd={() =>
                        setSelection(
                          window.getSelection()?.toString().trim() ?? "",
                        )
                      }
                    >
                      {displayedTranscript || "선택한 학습 구간에 자막이 없어요. 아래에서 구간을 확인해 주세요."}
                    </div>
                  )}
                </section>
              )}
              {session.step === 1 && (
                <section className="marked-section">
                  <h2>
                    이해가 안 되는 구간 <span>{session.marks.length}</span>
                  </h2>
                  {!session.marks.length && (
                    <p className="help">
                      표시한 표현이 아직 없어요.
                    </p>
                  )}
                  {session.marks.map((m) => (
                    <article
                      className={m.done ? "mark done" : "mark"}
                      key={m.id}
                    >
                      <div>
                        <label>
                          <input
                            type="checkbox"
                            checked={m.done}
                            onChange={(e) =>
                              update({
                                marks: session.marks.map((x) =>
                                  x.id === m.id
                                    ? { ...x, done: e.target.checked }
                                    : x,
                                ),
                              })
                            }
                          />
                          <mark>{m.text}</mark>
                        </label>
                        <button
                          className="icon-button"
                          aria-label={`${m.text} 삭제`}
                          onClick={() =>
                            update({
                              marks: session.marks.filter((x) => x.id !== m.id),
                            })
                          }
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                      <textarea
                        rows={2}
                        aria-label={`${m.text} 메모`}
                        placeholder="뜻, 소리의 연결, 다시 들을 부분을 메모하세요."
                        value={m.note}
                        onChange={(e) =>
                          update({
                            marks: session.marks.map((x) =>
                              x.id === m.id
                                ? { ...x, note: e.target.value }
                                : x,
                            ),
                          })
                        }
                      />
                    </article>
                  ))}
                </section>
              )}
              {(session.step === 5 || session.step === 6) && (
                <SegmentPractice key={session.id} sourceCues={session.transcriptCues} transcript={session.transcript} start={session.start} end={session.end} marks={session.marks}
                  onChange={marks => update({ marks })} looping={loop}
                  playbackRate={playbackRate} availableRates={availableRates} rateReady={ready}
                  onRateChange={rate => player.current?.setPlaybackRate(rate)}
                  onExtend={() => update({ remaining: session.remaining + 120, plan: session.plan.map((n, i) => i === session.step ? n + 120 : n) })}
                  onPlay={range => {
                    setManualStart(String(range.start)); setManualEnd(String(range.end)); setLoop(true);
                    loopRef.current = { loop: true, manualStart: String(range.start), manualEnd: String(range.end) };
                    setError(""); tracker.current.reset(); ended.current = false;
                    player.current?.seekTo(range.start, true);
                    setPaused(false); pausedRef.current = false;
                    player.current?.playVideo();
                  }}
                  onStop={() => { setLoop(false); loopRef.current.loop = false; setPaused(true); pausedRef.current = true; player.current?.pauseVideo(); }}
                />
              )}
              <div className="training-actions">
                {/* TEMP_NAV_SIX */}
                {/* END_TEMP_NAV_SIX */}
                {session.step > 0 && (
                  <button className="text-button" onClick={previous}>
                    <ArrowLeft size={16} /> PREV
                  </button>
                )}
                {session.step < 2 && (
                <button
                  className="quiet"
                  onClick={() =>
                    update({
                      remaining: session.remaining + 120,
                      plan: session.plan.map((n, i) =>
                        i === session.step ? n + 120 : n,
                      ),
                    })
                  }
                >
                  +2분 연장
                </button>
                )}
                <div className="next-controls">
                  <button
                    className="text-button next-stage"
                    disabled={!canAdvanceStage(session)}
                    onClick={advance}
                  >
                    NEXT
                    <ArrowRight size={16} />
                  </button>
                {session.step >= 2 && session.step <= 4 && (
                  <Help label="반복 완료 기준">
                    이번 단계의 실제 10회 재생이 끝나면 멈춥니다. 다음 단계로
                    버튼을 직접 눌러 이동하세요. 일시정지·버퍼링·앞으로
                    건너뛰기는 완료 횟수로 계산하지 않아요.
                  </Help>
                )}
                </div>
              </div>
              <div
                className={`player-section ${session.step >= 2 && session.step <= 4 ? "compact-player" : ""}`}
              >
                <p className="video-location-sign">
                  <ArrowDown size={16} aria-hidden="true" />
                  <span>아래에 YouTube 영상이 있습니다</span>
                </p>
                <YouTube
                  id={session.videoId}
                  start={session.start}
                  onReady={(p) => {
                    player.current = p;
                    const rates = p.getAvailablePlaybackRates();
                    setAvailableRates(rates.length ? rates : [1]);
                    setPlaybackRate(p.getPlaybackRate());
                    setReady(true);
                    if (session.end > p.getDuration() && p.getDuration() > 0) {
                      setError(
                        "선택한 종료 시간이 영상 길이보다 길어요. 시작 화면에서 구간을 수정해 주세요.",
                      );
                      setReady(false);
                    }
                  }}
                  onState={(n) => {
                    state.current = n;
                    if (n === 0) ended.current = true;
                    if (
                      n === 1 &&
                      (pausedRef.current ||
                        repetitionFinished(current.current ?? session) ||
                        (current.current?.gapRemaining ?? 0) > 0)
                    )
                      player.current?.pauseVideo();
                  }}
                  onPlaybackRateChange={rate => {
                    if (!Number.isFinite(rate) || rate <= 0) return;
                    if ((current.current?.step ?? 0) < 5 && rate !== 1) { player.current?.setPlaybackRate(1); return; }
                    setPlaybackRate(rate);
                    setSession(s => s && s.step >= 5 && s.practiceRate !== rate ? { ...s, practiceRate: rate } : s);
                  }}
                  onAutoplayBlocked={() =>
                    setError(
                      "브라우저가 자동 재생을 막았어요. 공식 플레이어의 재생 버튼을 눌러 주세요.",
                    )
                  }
                  onReload={() => {
                    setReady(false);
                    setPaused(true);
                    setError("");
                    player.current = null;
                    tracker.current.reset();
                  }}
                  onError={(message) => {
                    setError(message);
                    setReady(false);
                    if (!studyStage) setPaused(true);
                    player.current?.pauseVideo();
                  }}
                />
                <div className="player-caption">
                  <span>
                    {formatTime(session.start)} — {formatTime(session.end)} ·
                    {session.step >= 5 ? `${playbackRate}×` : "원래 재생 속도"}
                  </span>
                  <a href={session.url} target="_blank" rel="noopener">
                    YouTube에서 보기
                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>
              <details className="session-settings">
                <summary>자료를 다시 설정해야 하나요?</summary>
                {session.step < 2 && session.start === 0 && session.end === 40 && firstSpeechRange(session.transcriptCues?.length ? session.transcriptCues : KNOWN_CAPTIONS[session.videoId] ?? []) && (
                  <button className="quiet" onClick={() => {
                    const range = firstSpeechRange(session.transcriptCues?.length ? session.transcriptCues : KNOWN_CAPTIONS[session.videoId] ?? []);
                    if (!range) return;
                    player.current?.pauseVideo(); setPaused(true); pausedRef.current = true; tracker.current.reset(); ended.current = false;
                    setManualStart(String(range.start)); setManualEnd(String(range.end));
                    update({ ...range });
                    player.current?.seekTo(range.start, true);
                  }}>첫 대사부터 40초로 맞추기</button>
                )}
                <p>
                  지금까지의 훈련은 완료 기록으로 저장되지 않습니다. 완료 기록은
                  보존됩니다.
                </p>
                <button
                  className="quiet"
                  onClick={() => {
                    setSession(null);
                    setReady(false);
                    setPaused(true);
                    player.current?.pauseVideo();
                    try {
                      localStorage.removeItem(STORAGE.active);
                    } catch {}
                  }}
                >
                  시작 화면으로 돌아가기
                </button>
              </details>
            </div>
          </div>
        )}
      </main>
      <footer>
        <span>Listening Lab</span>

        <span className="with-help">
          기록 저장
          <Help label="기록 저장">
            로그인 없이 이 기기·브라우저에 저장됩니다. 브라우저 데이터를
            삭제하면 기록도 지워집니다. 완료한 결과는 학습 기록에서 다시 확인할
            수 있어요.
          </Help>
        </span>
      </footer>
    </div>
  );
}
