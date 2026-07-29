import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { ANALYSIS_MODEL_ALLOWLIST, assertAnalysisModelPolicy } from "../lib/server/model-policy.ts";

test("analysis provider allowlist is fixed", () => {
  assert.deepEqual(ANALYSIS_MODEL_ALLOWLIST, {
    kie: "gpt-5-6-terra",
    qwen: "qwen3.6-flash",
    glm: "glm-4.6v-flash",
  });
  for (const [provider, model] of Object.entries(ANALYSIS_MODEL_ALLOWLIST)) assert.doesNotThrow(() => assertAnalysisModelPolicy(provider, model));
  assert.throws(() => assertAnalysisModelPolicy("deepseek", "deepseek-v4"), /model_policy_error/);
  assert.throws(() => assertAnalysisModelPolicy("qwen", "qwen-max"), /model_policy_error/);
});

test("analysis schema rejects unknown catalog ids and invalid enums", () => {
  const source = readFileSync(new URL("../lib/server/openai.ts", import.meta.url), "utf8");
  assert.match(source, /validStyleIds\.has\(item\.styleId\)/);
  assert.match(source, /analysis_style_invalid/);
  assert.match(source, /enumChecks\.some/);
  assert.match(source, /analysis_schema_invalid/);
});

test("text-first analysis completes without image generation or quality checks", () => {
  const source = readFileSync(new URL("../lib/server/processor.ts", import.meta.url), "utf8");
  const analysisBlock = source.slice(source.indexOf("export async function analyzeJob"), source.indexOf("export async function generateSelected"));
  assert.match(analysisBlock, /status: textFirst \? "analysis_ready"/);
  assert.doesNotMatch(analysisBlock, /beginKiePortraitEdit|qualityCheck|editPortrait/);
});

test("image preview endpoints fail closed when the global switch is off", () => {
  const generate = readFileSync(new URL("../app/api/v1/hair-jobs/[jobId]/generate/route.ts", import.meta.url), "utf8");
  assert.match(generate, /imagePreviewEnabled/);
  assert.match(generate, /image_preview_disabled/);
});
