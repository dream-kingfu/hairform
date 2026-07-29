import assert from "node:assert/strict";
import test from "node:test";
import { createPasswordHash, verifyPasswordHash } from "../lib/server/admin-crypto.ts";
import { readFileSync } from "node:fs";

test("admin password uses PBKDF2 SHA-256 and rejects incorrect passwords", async () => {
  const encoded = await createPasswordHash("a-long-test-password", 100000);
  assert.match(encoded, /^pbkdf2_sha256_hex:100000:/);
  assert.equal(await verifyPasswordHash("a-long-test-password", encoded), true);
  assert.equal(await verifyPasswordHash("wrong-password", encoded), false);
  assert.equal(await verifyPasswordHash("anything", undefined), false);
});

test("admin responses expose only provider key configuration state", () => {
  const runtime = readFileSync(new URL("../lib/server/ai-runtime.ts", import.meta.url), "utf8");
  assert.match(runtime, /keyConfigured: isAnalysisProviderConfigured/);
  assert.doesNotMatch(runtime, /KIE_API_KEY\s*[,}]/);
  assert.doesNotMatch(runtime, /QWEN_API_KEY\s*[,}]/);
  assert.doesNotMatch(runtime, /GLM_API_KEY\s*[,}]/);
});
