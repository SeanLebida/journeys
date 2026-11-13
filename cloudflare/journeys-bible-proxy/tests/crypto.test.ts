import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { hmacSha256Hex } from "../src/crypto.ts";
import { windowHasExpired } from "../src/rate-limit-window.ts";

describe("hmacSha256Hex", () => {
  test("is stable, keyed, and does not contain the raw value", async () => {
    const first = await hmacSha256Hex("salt-a", "203.0.113.10");
    const again = await hmacSha256Hex("salt-a", "203.0.113.10");
    const otherSalt = await hmacSha256Hex("salt-b", "203.0.113.10");
    const otherIp = await hmacSha256Hex("salt-a", "203.0.113.11");
    assert.equal(first, again);
    assert.equal(first.length, 32);
    assert.match(first, /^[0-9a-f]+$/);
    assert.notEqual(first, otherSalt);
    assert.notEqual(first, otherIp);
    assert.equal(first.includes("203.0.113.10"), false);
  });
});

describe("rate limiter window expiry", () => {
  test("clears the stored window once it expires", () => {
    const state = { windowStart: 1_000, count: 4, windowMs: 60_000 };
    assert.equal(windowHasExpired(state, 1_000 + 59_999), false);
    assert.equal(windowHasExpired(state, 1_000 + 60_000), true);
  });
});
