import { test } from "node:test";
import assert from "node:assert/strict";
import { officialSource, parseOfficialTranscript } from "./official-transcript";
test("official script parser excludes questions, answers, scripts and footer", () => {
  const result = parseOfficialTranscript(
    "<p>Before you view:</p><p>Question?</p><p><strong>Transcript:&nbsp;</strong></p><p>First speaker: This is the dialogue.</p><p>Second speaker: That is right.</p><p><strong>After you view answers:</strong></p><p>TRUE</p><script>Transcript: bad</script>",
  );
  assert.equal(
    result,
    "First speaker: This is the dialogue.\n\nSecond speaker: That is right.",
  );
  assert.throws(() => parseOfficialTranscript("<p>No script here.</p>"));
});
test("only official ABC learn-English pages are allowed as sources", () => {
  assert.match(officialSource("bjcGHsmf540"), /11741316/);
  assert.match(officialSource("KysPzRkN9uw"), /11754412/);
  for (const source of [
    "http://127.0.0.1/",
    "https://www.abc.net.au.evil.test/education/learn-english/x",
    "https://www.abc.net.au:444/education/learn-english/x",
    "https://user:pass@www.abc.net.au/education/learn-english/x",
    "https://www.abc.net.au/news/x",
  ])
    assert.throws(() => officialSource("", source));
  assert.throws(() => officialSource("unknown"));
});
