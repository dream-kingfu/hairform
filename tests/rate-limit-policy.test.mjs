import assert from "node:assert/strict";
import test from "node:test";
import { isRateLimitAllowlisted, rateLimitAllowlist } from "../lib/server/rate-limit-policy.ts";

test("matches only exact public IP allowlist entries", () => {
  const raw = "203.0.113.10, 2001:db8::10;198.51.100.2";
  assert.equal(isRateLimitAllowlisted("203.0.113.10", raw), true);
  assert.equal(isRateLimitAllowlisted("::ffff:203.0.113.10", raw), true);
  assert.equal(isRateLimitAllowlisted("2001:DB8::10", raw), true);
  assert.equal(isRateLimitAllowlisted("203.0.113.11", raw), false);
});

test("does not interpret wildcards or CIDR ranges", () => {
  assert.equal(isRateLimitAllowlisted("203.0.113.10", "*"), false);
  assert.equal(isRateLimitAllowlisted("203.0.113.10", "203.0.113.0/24"), false);
  assert.deepEqual([...rateLimitAllowlist(undefined)], []);
});
