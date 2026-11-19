export type Answers = {
  comprehension: number;
  before: number;
  after: number;
  remaining: number;
  difficulty: number;
};
export type Level = "LEVEL UP" | "KEEP LEVEL" | "LEVEL DOWN";
export type Recommendation = { level: Level; reasons: string[]; guide: string };
export const questions: {
  key: keyof Answers;
  title: string;
  options: string[];
}[] = [
  {
    key: "comprehension",
    title: "스크립트를 읽었을 때 대부분 이해할 수 있었나요?",
    options: [
      "거의 이해하지 못했어요 · 25% 미만",
      "일부만 이해했어요 · 25~49%",
      "절반 이상 이해했어요 · 50~74%",
      "대부분 이해했어요 · 75~89%",
      "거의 모두 이해했어요 · 90~100%",
    ],
  },
  {
    key: "before",
    title: "처음 들었을 때 실제 영어를 얼마나 정확하게 인식했나요?",
    options: [
      "몇 단어만 들렸어요",
      "일부 표현이 들렸어요",
      "절반 정도 들렸어요",
      "대부분 들렸어요",
      "거의 모두 들렸어요",
    ],
  },
  {
    key: "after",
    title: "30회 반복 훈련 후, 실제 영어가 얼마나 정확하게 들리나요?",
    options: [
      "몇 단어만 들려요",
      "일부 표현만 들려요",
      "절반 정도 들려요",
      "대부분 들려요",
      "거의 모두 들려요",
    ],
  },
  {
    key: "remaining",
    title: "반복 후에도 인식하지 못한 부분이 얼마나 남아 있나요?",
    options: [
      "거의 없어요",
      "조금 남아 있어요",
      "상당히 남아 있어요",
      "대부분 여전히 어려워요",
    ],
  },
  {
    key: "difficulty",
    title: "학습 자료의 전반적인 난이도는 어땠나요?",
    options: [
      "너무 쉬웠어요",
      "조금 쉬웠어요",
      "적절했어요",
      "조금 어려웠어요",
      "너무 어려웠어요",
    ],
  },
];
export function validAnswers(a: Partial<Answers>): a is Answers {
  return questions.every(
    (q) =>
      Number.isInteger(a[q.key]) &&
      a[q.key]! >= 0 &&
      a[q.key]! < q.options.length,
  );
}
export function recommend(a: Answers): Recommendation {
  if (!validAnswers(a)) throw new Error("다섯 가지 질문에 모두 응답해 주세요.");
  // Initial recognition is intentionally excluded from UP/DOWN eligibility.
  if (
    a.comprehension <= 1 &&
    a.after <= 1 &&
    a.remaining >= 2 &&
    a.difficulty >= 3
  )
    return {
      level: "LEVEL DOWN",
      reasons: [
        "스크립트 자체를 이해하기 어려웠어요.",
        "반복 후에도 많은 소리가 들리지 않았고, 자료가 어렵게 느껴졌어요.",
      ],
      guide:
        "다음에는 조금 더 쉬운 자료를 골라 보세요. 스크립트를 읽으면 대부분 이해되는 짧은 구간을 ChatGPT와 함께 찾아보세요.",
    };
  if (
    a.comprehension >= 3 &&
    a.after === 4 &&
    a.remaining === 0 &&
    a.difficulty <= 2
  )
    return {
      level: "LEVEL UP",
      reasons: [
        "스크립트를 충분히 이해했어요.",
        "반복 후 거의 모든 소리를 인식했고, 남은 어려움이 거의 없어요.",
      ],
      guide:
        "다음에는 조금 더 어려운 자료에 도전해 보세요. 스크립트는 여전히 대부분 이해할 수 있는 범위에서, 발화 속도나 표현의 복잡도를 조금 높여 달라고 ChatGPT에 요청해 보세요.",
    };
  return {
    level: "KEEP LEVEL",
    reasons:
      a.comprehension >= 3 && a.after > a.before && a.remaining > 0
        ? [
            "스크립트를 대부분 이해했고, 반복하면서 더 많은 소리를 인식했어요.",
            "아직 어려운 부분이 남아 있어 비슷한 난이도로 연결을 더 단단하게 만들 수 있어요.",
          ]
        : [
            "응답을 함께 보면 난이도를 바꿀 근거가 충분히 일치하지 않아요.",
            "비슷한 난이도의 새 자료로 소리 인식을 한 번 더 확인해 보세요.",
          ],
    guide:
      "다음에도 비슷한 난이도의 자료를 선택해 보세요. 선호하는 억양과 학습 목적은 유지하면서 새로운 주제의 자료를 ChatGPT에서 찾아보세요.",
  };
}
export function allocate(duration: number): number[] {
  if (!Number.isFinite(duration) || duration < 2)
    throw new Error("학습 구간은 최소 2초로 선택해 주세요.");
  // Keep a one-hour baseline. Above 40s, preserve 40 minutes for the other stages.
  const rest = Math.max(2400, 3600 - duration * 30);
  const first = Math.floor(rest * 0.15),
    study = Math.floor(rest * 0.35),
    difficult = Math.floor(rest * 0.25);
  return [
    first,
    study,
    duration * 10,
    duration * 10,
    duration * 10,
    difficult,
    rest - first - study - difficult,
  ];
}
export function videoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (!["https:", "http:"].includes(u.protocol)) return null;
    const host = u.hostname.replace(/^www\./, "");
    const id =
      host === "youtu.be"
        ? u.pathname.slice(1)
        : ["youtube.com", "m.youtube.com"].includes(host)
          ? u.searchParams.get("v") ||
            u.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1]
          : null;
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}
export const steps = [
  "First Listening",
  "Transcript Study",
  "Listening × 10",
  "Listening × 10",
  "Listening × 10",
  "Difficult Parts",
  "Shadowing",
];
export const instructions = [
  "먼저 한 번 집중해서 듣고 PAUSE를 누른 뒤, 기억나는 단어와 문장을 적어보세요. 필요하면 PLAY로 다시 들을 수 있습니다. 확실히 들린 부분과 추측한 부분을 구분하세요.",
  "오디오를 잠시 멈추고 원문의 의미를 충분히 이해하세요. 어려운 표현을 선택해 표시하고 메모를 남겨 보세요.",
  "스크립트 없이 같은 구간을 열 번 들어 보세요. 이미 알고 있는 표현과 실제 소리를 연결하세요.",
  "같은 구간을 다시 열 번 들으며, 처음에 들리지 않았던 부분이 인식되는지 확인하세요. 필요하면 스크립트 열기로 어려운 부분을 잠시 확인하고 소리와 연결하세요.",
  "마지막 열 번. 처음에 잘못 들었던 표현의 소리에 집중하세요.",
  "아직 들리지 않는 표현을 다시 만나 보세요. 필요한 구간을 직접 지정해 반복하고, 이해한 표현은 완료 표시하세요.",
  "원어민의 리듬과 강세를 따라 말해 보세요. 정확한 소리를 내는 감각을 기억하세요.",
];
export type Mark = { id: string; text: string; note: string; done: boolean; rangeOrigin?: "manual" | "caption"; range?: { start: number; end: number } };
export type Session = {
  id: string;
  url: string;
  videoId: string;
  start: number;
  end: number;
  transcript: string;
  plan: number[];
  phase: "training" | "assessment" | "result";
  step: number;
  remaining: number;
  elapsed: number;
  elapsedStartedAt?: number;
  remainingByStep?: number[];
  counts: number[];
  before: string;
  after: string;
  answers: Partial<Answers>;
  marks: Mark[];
  answerVersion?: 2;
  practiceRate?: number;
  gapSeconds?: number;
  gapRemaining?: number;
  transcriptSource?: string;
  transcriptCues?: import("./transcript-cues").TranscriptCue[];
  completedAt?: string;
  recommendation?: Recommendation;
  series?: { id: string; index: number; total: number };
};
export const STORAGE = {
  active: "listening-lab.active.v1",
  history: "listening-lab.history.v1",
  pending: "listening-lab.pending.v1",
};
export function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function formatTime(sec: number) {
  const n = Math.max(0, Math.floor(sec));
  return `${Math.floor(n / 60)
    .toString()
    .padStart(2, "0")}:${(n % 60).toString().padStart(2, "0")}`;
}
// A repeat needs continuous real PLAYING coverage, not a timer or a seek to the end.
export class RepeatTracker {
  coverage = 0;
  last: number | null = null;
  reset() {
    this.coverage = 0;
    this.last = null;
  }
  sample(
    time: number,
    playing: boolean,
    start: number,
    end: number,
    delta: number,
  ) {
    if (!playing) {
      this.last = null;
      return false;
    }
    if (this.last !== null) {
      const advance = time - this.last;
      if (advance >= 0 && advance <= delta + 0.45) this.coverage += advance;
      else this.coverage = 0;
    }
    this.last = time;
    return time >= end - 0.12 && this.coverage >= end - start - 0.5;
  }
}

export function canAdvanceStage(
  s: Pick<Session, "step" | "transcript" | "counts">,
): boolean {
  if (s.step === 1) return Boolean(s.transcript.trim());
  if (s.step >= 2 && s.step <= 4) return s.counts[s.step - 2] >= 10;
  return true;
}

export function splitRange(start: number, end: number): [number, number][] {
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    end - start < 4
  )
    throw new Error("두 세션으로 나누려면 4초 이상의 구간을 선택해 주세요.");
  const middle = start + Math.floor((end - start) / 2);
  return [
    [start, middle],
    [middle, end],
  ];
}
export function createSessions(
  url: string,
  start: number,
  end: number,
  split: boolean,
): Session[] {
  const id = videoId(url);
  if (!id) throw new Error("유효한 YouTube 영상 링크를 입력해 주세요.");
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    end <= start
  )
    throw new Error("시작·종료 시간을 0 이상의 정수 초로 확인해 주세요.");
  const ranges = split ? splitRange(start, end) : [[start, end]];
  const group = crypto.randomUUID();
  return ranges.map(([a, b], i) => {
    const plan = allocate(b - a);
    return {
      id: crypto.randomUUID(),
      url,
      videoId: id,
      start: a,
      end: b,
      transcript: "",
      plan,
      phase: "training",
      step: 0,
      remaining: plan[0],
      elapsed: 0,
      counts: [0, 0, 0],
      before: "",
      after: "",
      answers: {},
      marks: [],
      answerVersion: 2,
      gapSeconds: 3,
      gapRemaining: 0,
      ...(split
        ? { series: { id: group, index: i + 1, total: ranges.length } }
        : {}),
    };
  });
}

export function canTickStage(
  session: Pick<Session, "step" | "transcript">,
  activity: {
    paused: boolean;
    hidden: boolean;
    playerAvailable: boolean;
    playing: boolean;
    ended: boolean;
  },
): boolean {
  if (activity.paused || activity.hidden) return false;
  if (session.step === 1) return Boolean(session.transcript.trim());
  if (session.step === 5) return true;
  return activity.playerAvailable && (activity.playing || activity.ended);
}

export function repetitionFinished(
  s: Pick<Session, "step" | "counts">,
): boolean {
  return s.step >= 2 && s.step <= 4 && s.counts[s.step - 2] >= 10;
}
export function assessmentLabel(
  s: Pick<Session, "answers" | "answerVersion">,
  key: keyof Answers,
): string {
  const value = s.answers[key];
  if (value === undefined) return "응답 없음";
  if (key === "comprehension" && s.answerVersion !== 2)
    return (
      [
        "거의 이해하지 못했어요",
        "이해하기 어려운 부분이 많았어요",
        "대부분 이해했어요",
        "충분히 이해했어요",
      ][value] ?? "응답 없음"
    );
  return questions.find((q) => q.key === key)?.options[value] ?? "응답 없음";
}

/** Wall-clock duration includes pauses and time spent away from the tab. */
export function wallElapsed(startedAt: number, now: number): number {
  return Math.max(0, (now - startedAt) / 1000);
}
