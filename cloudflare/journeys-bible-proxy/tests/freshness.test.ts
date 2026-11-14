import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { sharedFreshness, stillFresh } from "../src/freshness.ts";

const NOW = Date.parse("2026-11-13T12:00:00Z");

function headers(init: Record<string, string>): Headers {
  return new Headers(init);
}

describe("sharedFreshness", () => {
  test("max-age is the lifetime when s-maxage is absent", () => {
    assert.deepEqual(sharedFreshness(headers({ "cache-control": "public, max-age=120" }), NOW), { store: true, maxAge: 120 });
  });

  test("s-maxage wins over a longer max-age", () => {
    assert.deepEqual(
      sharedFreshness(headers({ "cache-control": "public, max-age=86400, s-maxage=30" }), NOW),
      { store: true, maxAge: 30 },
    );
  });

  test("Age shortens the life, and a used-up life is not stored", () => {
    assert.deepEqual(sharedFreshness(headers({ "cache-control": "max-age=100", age: "40" }), NOW), { store: true, maxAge: 60 });
    assert.deepEqual(sharedFreshness(headers({ "cache-control": "max-age=100", age: "100" }), NOW), { store: false, maxAge: 0 });
  });

  test("no-store, private, no-cache, and max-age 0 are not stored", () => {
    for (const value of ["no-store, max-age=120", "private, max-age=120", "public, no-cache, max-age=120", "max-age=0"]) {
      assert.equal(sharedFreshness(headers({ "cache-control": value }), NOW).store, false, value);
    }
  });

  test("a missing lifetime is not stored", () => {
    assert.deepEqual(sharedFreshness(headers({}), NOW), { store: false, maxAge: 0 });
  });

  test("Expires is used only when max-age and s-maxage are absent", () => {
    const soon = new Date(NOW + 90_000).toUTCString();
    const past = new Date(NOW - 1000).toUTCString();
    assert.deepEqual(sharedFreshness(headers({ expires: soon }), NOW), { store: true, maxAge: 90 });
    assert.equal(sharedFreshness(headers({ expires: past }), NOW).store, false);
    assert.deepEqual(
      sharedFreshness(headers({ "cache-control": "max-age=10", expires: soon }), NOW),
      { store: true, maxAge: 10 },
    );
  });

  test("Vary other than Accept-Encoding is not stored", () => {
    assert.equal(sharedFreshness(headers({ "cache-control": "max-age=10", vary: "Accept-Encoding" }), NOW).store, true);
    assert.equal(sharedFreshness(headers({ "cache-control": "max-age=10", vary: "Accept-Language" }), NOW).store, false);
    assert.equal(sharedFreshness(headers({ "cache-control": "max-age=10", vary: "Accept-Encoding, Accept-Language" }), NOW).store, false);
  });
});

describe("stillFresh", () => {
  test("a stored response is fresh only inside its max-age from Date", () => {
    const cached = new Response("{}", { headers: { date: new Date(NOW).toUTCString(), "cache-control": "public, max-age=30" } });
    assert.equal(stillFresh(cached, NOW + 29_000), true);
    assert.equal(stillFresh(cached, NOW + 30_000), false);
    assert.equal(stillFresh(new Response("{}", { headers: { "cache-control": "public, max-age=30" } }), NOW), false);
  });
});
