import { test } from "node:test";
import assert from "node:assert/strict";
import {
  recommend,
  allocate,
  splitRange,
  createSessions,
  videoId,
  RepeatTracker,
  validAnswers,
  type Answers,
} from "./domain";
const good: Answers = {
  comprehension: 3,
  before: 0,
  after: 4,
  remaining: 0,
  difficulty: 2,
};
test("clear success levels up regardless of first recognition", () => {
  for (let before = 0; before < 5; before++)
    assert.equal(recommend({ ...good, before }).level, "LEVEL UP");
});
test("level down requires all four signals, independent of initial recognition", () => {
  const hard = {
    comprehension: 0,
    before: 4,
    after: 1,
    remaining: 3,
    difficulty: 4,
  };
  assert.equal(recommend(hard).level, "LEVEL DOWN");
  for (const patch of [
    { comprehension: 2 },
    { after: 3 },
    { remaining: 0 },
    { difficulty: 2 },
  ])
    assert.equal(recommend({ ...hard, ...patch }).level, "KEEP LEVEL");
});
test("improvement with remaining difficulty keeps level", () =>
  assert.equal(
    recommend({ ...good, after: 3, remaining: 1 }).level,
    "KEEP LEVEL",
  ));
test("all response combinations are deterministic and conservative", () => {
  for (let c = 0; c < 5; c++)
    for (let b = 0; b < 5; b++)
      for (let a = 0; a < 5; a++)
        for (let r = 0; r < 4; r++)
          for (let d = 0; d < 5; d++) {
            const x = {
              comprehension: c,
              before: b,
              after: a,
              remaining: r,
              difficulty: d,
            };
            const result = recommend(x);
            if (result.level === "LEVEL DOWN")
              assert.ok(c <= 1 && a <= 1 && r >= 2 && d >= 3);
            if (result.level === "LEVEL UP")
              assert.ok(c >= 3 && a === 4 && r === 0 && d <= 2);
          }
});
test("partial or invalid assessment never generates a result", () => {
  assert.equal(validAnswers({}), false);
  assert.throws(() => recommend({ ...good, after: 9 }));
});
test("allocation keeps a one-hour baseline and extends long clips without reducing repetitions", () => {
  for (const n of [2, 40, 41, 60, 90, 120, 600]) {
    const p = allocate(n);
    assert.equal(
      p.reduce((a, b) => a + b),
      Math.max(3600, n * 30 + 2400),
    );
    assert.equal(p[2] + p[3] + p[4], n * 30);
  }
  for (const n of [NaN, Infinity, -1, 0, 1]) assert.throws(() => allocate(n));
  assert.equal(
    allocate(60).reduce((a, b) => a + b),
    70 * 60,
  );
  assert.equal(
    allocate(120).reduce((a, b) => a + b),
    100 * 60,
  );
});
test("YouTube URL parser rejects unrelated domains", () => {
  assert.equal(videoId("https://youtu.be/M7lc1UVf-VE"), "M7lc1UVf-VE");
  assert.equal(
    videoId("https://youtube.com/watch?v=M7lc1UVf-VE"),
    "M7lc1UVf-VE",
  );
  assert.equal(videoId("https://evil.test/watch?v=M7lc1UVf-VE"), null);
});
test("repeat tracker ignores buffering, partial playback and seek jumps", () => {
  const t = new RepeatTracker();
  assert.equal(t.sample(9.9, true, 0, 10, 0.25), false);
  t.reset();
  for (let n = 0; n <= 40; n++) {
    const done = t.sample(n * 0.25, true, 0, 10, 0.25);
    assert.equal(done, n === 40);
  }
  t.reset();
  t.sample(0, true, 0, 10, 0.25);
  assert.equal(t.sample(9.9, true, 0, 10, 0.25), false);
  t.reset();
  t.sample(0, true, 0, 10, 0.25);
  t.sample(5, false, 0, 10, 0.25);
  assert.equal(t.sample(10, true, 0, 10, 0.25), false);
});

test("stage two waits for transcript, repeats wait for ten actual plays", async () => {
  const { canAdvanceStage } = await import("./domain");
  assert.equal(
    canAdvanceStage({ step: 0, transcript: "", counts: [0, 0, 0] }),
    true,
  );
  assert.equal(
    canAdvanceStage({ step: 1, transcript: "  ", counts: [0, 0, 0] }),
    false,
  );
  assert.equal(
    canAdvanceStage({
      step: 1,
      transcript: "The transcript.",
      counts: [0, 0, 0],
    }),
    true,
  );
  for (let step = 2; step <= 4; step++) {
    const counts = [10, 10, 10];
    counts[step - 2] = 9;
    assert.equal(canAdvanceStage({ step, transcript: "text", counts }), false);
    counts[step - 2] = 10;
    assert.equal(canAdvanceStage({ step, transcript: "text", counts }), true);
  }
});

test("split ranges cover the original interval without overlap or gaps, including odd lengths", () => {
  for (const [a, b] of [
    [0, 120],
    [120, 240],
    [17, 58],
    [0, 4],
  ]) {
    const [first, second] = splitRange(a, b);
    assert.equal(first[0], a);
    assert.equal(first[1], second[0]);
    assert.equal(second[1], b);
    assert.ok(first[1] - first[0] >= 2 && second[1] - second[0] >= 2);
    assert.ok(Math.abs(first[1] - first[0] - (second[1] - second[0])) <= 1);
  }
  for (const [a, b] of [
    [0, 3],
    [-1, 10],
    [0, Infinity],
    [1.5, 8],
  ])
    assert.throws(() => splitRange(a, b));
});
test("two sessions have independent notes, assessments and thirty repetitions while sharing a series", () => {
  const sessions = createSessions(
    "https://youtu.be/M7lc1UVf-VE",
    120,
    240,
    true,
  );
  assert.equal(sessions.length, 2);
  assert.notEqual(sessions[0].id, sessions[1].id);
  assert.equal(sessions[0].series?.id, sessions[1].series?.id);
  assert.deepEqual(
    sessions.map((s) => [s.start, s.end, s.series?.index]),
    [
      [120, 180, 1],
      [180, 240, 2],
    ],
  );
  for (const s of sessions) {
    assert.equal(
      s.plan.reduce((a, b) => a + b),
      4200,
    );
    assert.equal(s.step, 0);
    assert.deepEqual(s.counts, [0, 0, 0]);
    assert.equal(s.transcript, "");
  }
  sessions[0].before = "first recording";
  sessions[0].answers.after = 4;
  sessions[0].counts[0] = 10;
  assert.equal(sessions[1].before, "");
  assert.deepEqual(sessions[1].answers, {});
  assert.deepEqual(sessions[1].counts, [0, 0, 0]);
  assert.deepEqual(JSON.parse(JSON.stringify(sessions)), sessions);
});
test("whole long session remains a single seven-stage training, without an arbitrary ninety-second cap", () => {
  const [s] = createSessions("https://youtu.be/M7lc1UVf-VE", 0, 120, false);
  assert.equal(s.series, undefined);
  assert.equal(s.plan.length, 7);
  assert.equal(
    s.plan.reduce((a, b) => a + b),
    6000,
  );
  assert.throws(() => createSessions("https://evil.test", 0, 120, true));
  assert.throws(() =>
    createSessions("https://youtu.be/M7lc1UVf-VE", 3, 2, false),
  );
});

test("transcript-study timer runs without a loaded or playing YouTube player", async () => {
  const { canTickStage } = await import("./domain");
  const active = {
    paused: false,
    hidden: false,
    playerAvailable: false,
    playing: false,
    ended: false,
  };
  assert.equal(
    canTickStage({ step: 1, transcript: "Original script." }, active),
    true,
  );
  assert.equal(canTickStage({ step: 1, transcript: "  " }, active), false);
  assert.equal(
    canTickStage(
      { step: 1, transcript: "Original script." },
      { ...active, paused: true },
    ),
    false,
  );
  assert.equal(
    canTickStage(
      { step: 1, transcript: "Original script." },
      { ...active, hidden: true },
    ),
    false,
  );
  assert.equal(
    canTickStage({ step: 5, transcript: "Original script." }, active),
    true,
  );
  assert.equal(
    canTickStage({ step: 2, transcript: "Original script." }, active),
    false,
  );
  assert.equal(
    canTickStage(
      { step: 2, transcript: "Original script." },
      { ...active, playerAvailable: true, playing: true },
    ),
    true,
  );
});

test("completion holds the same repetition stage until learner explicitly advances", async () => {
  const { repetitionFinished, canAdvanceStage } = await import("./domain");
  for (let step = 2; step <= 4; step++) {
    const counts = [0, 0, 0];
    counts[step - 2] = 9;
    const s = { step, counts, transcript: "text" };
    assert.equal(repetitionFinished(s), false);
    assert.equal(canAdvanceStage(s), false);
    counts[step - 2] = 10;
    assert.equal(repetitionFinished(s), true);
    assert.equal(canAdvanceStage(s), true);
    assert.equal(s.step, step);
  }
});
test("five-point comprehension scale uses mostly-understood threshold and preserves legacy labels", async () => {
  const { assessmentLabel, questions } = await import("./domain");
  assert.equal(questions[0].options.length, 5);
  assert.equal(recommend({ ...good, comprehension: 2 }).level, "KEEP LEVEL");
  assert.equal(recommend({ ...good, comprehension: 3 }).level, "LEVEL UP");
  assert.equal(recommend({ ...good, comprehension: 4 }).level, "LEVEL UP");
  assert.equal(
    assessmentLabel({ answers: { comprehension: 2 } }, "comprehension"),
    "대부분 이해했어요",
  );
  assert.match(
    assessmentLabel(
      { answers: { comprehension: 2 }, answerVersion: 2 },
      "comprehension",
    ),
    /50~74/,
  );
});

test("wall-clock duration includes pauses and long background gaps", async () => {
  const { wallElapsed } = await import("./domain");
  const start = 1_000_000;
  assert.equal(wallElapsed(start, start + 12_000), 12);
  assert.equal(wallElapsed(start, start + 3_600_000), 3600);
  assert.equal(wallElapsed(start, start - 1000), 0);
});
