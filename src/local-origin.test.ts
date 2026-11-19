import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalLocalOrigin } from "./local-origin";
test("numeric loopback migration stays on the same local port", () => {
  assert.equal(
    canonicalLocalOrigin("http://127.0.0.1:5176/?token=x"),
    "http://localhost:5176",
  );
  assert.equal(
    canonicalLocalOrigin("http://127.0.0.1:8080/"),
    "http://localhost:8080",
  );
});
test("never redirects or transfers records for non-local sites", () => {
  for (const url of [
    "https://example.com",
    "https://127.0.0.1",
    "http://localhost:5176",
    "http://127.0.0.1.evil.test:5176",
  ])
    assert.equal(canonicalLocalOrigin(url), null);
});
