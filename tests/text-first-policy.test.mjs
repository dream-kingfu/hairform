import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { ANALYSIS_MODEL_ALLOWLIST, CONSULTATION_MODEL_ALLOWLIST, assertAnalysisModelPolicy, assertConsultationModelPolicy } from "../lib/server/model-policy.ts";

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

test("consultation provider allowlist is limited to GPT and Qwen", () => {
  assert.deepEqual(CONSULTATION_MODEL_ALLOWLIST, { kie: "gpt-5-6-terra", qwen: "qwen3.6-flash" });
  for (const [provider, model] of Object.entries(CONSULTATION_MODEL_ALLOWLIST)) assert.doesNotThrow(() => assertConsultationModelPolicy(provider, model));
  assert.throws(() => assertConsultationModelPolicy("deepseek", "deepseek-v4"), /model_policy_error/);
  assert.throws(() => assertConsultationModelPolicy("glm", "glm-4.6v-flash"), /model_policy_error/);
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

test("text-first users can explicitly select a hairstyle or hair color before generation", () => {
  const generate = readFileSync(new URL("../app/api/v1/hair-jobs/[jobId]/generate/route.ts", import.meta.url), "utf8");
  const app = readFileSync(new URL("../app/HairApp.tsx", import.meta.url), "utf8");
  const jobs = readFileSync(new URL("../lib/server/jobs.ts", import.meta.url), "utf8");
  for (const id of ["best_short", "best_medium", "best_long", "color_primary", "color_secondary"]) {
    assert.match(generate, new RegExp(id));
    assert.match(jobs, new RegExp(id));
  }
  assert.match(app, /pendingAssetId/);
  assert.match(app, /选这款发色/);
  assert.match(app, /生成.*完整预览/);
  assert.match(app, /\["analysis_ready", "awaiting_selection", "completed", "partial"\]\.includes\(job\.status\)/);
});
