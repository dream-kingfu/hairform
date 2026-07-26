import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const providerSource = await readFile(new URL("../lib/server/openai.ts", import.meta.url), "utf8");
const policySource = await readFile(new URL("../lib/server/model-policy.ts", import.meta.url), "utf8");
const jobsSource = await readFile(new URL("../lib/server/jobs.ts", import.meta.url), "utf8");
const envExample = await readFile(new URL("../.env.example", import.meta.url), "utf8");

test("uses Kie file upload and asynchronous GPT Image 2 task APIs", () => {
  assert.match(providerSource, /kieai\.redpandaai\.co/);
  assert.match(providerSource, /\/api\/file-stream-upload/);
  assert.match(providerSource, /\/api\/file-base64-upload/);
  assert.match(providerSource, /bytes\.byteLength <= 2 \* 1024 \* 1024/);
  assert.match(providerSource, /\/api\/v1\/jobs\/createTask/);
  assert.match(policySource, /gpt-image-2-image-to-image/);
  assert.match(providerSource, /\/api\/v1\/jobs\/recordInfo\?taskId=/);
  assert.match(providerSource, /resultUrls/);
  assert.match(providerSource, /downloadKieImage/);
  assert.match(providerSource, /maskUrl \? \[inputUrl, maskUrl\] : \[inputUrl\]/);
  assert.match(providerSource, /binary edit guide/);
  assert.match(providerSource, /const fallback = isKie\(\) \? 1 : 3/);
});

test("keeps Kie secrets server-side and requires demo mode explicitly", () => {
  assert.match(jobsSource, /KIE_API_KEY\?: string/);
  assert.match(jobsSource, /return bindings\.DEMO_MODE === "true"/);
  assert.match(envExample, /AI_PROVIDER=kie/);
  assert.match(envExample, /KIE_API_KEY=/);
  assert.doesNotMatch(envExample, /KIE_API_KEY=\S+/);
});

test("uses Kie multimodal analysis without changing the fixed catalog contract", () => {
  assert.match(providerSource, /\/codex\/v1\/responses/);
  assert.match(policySource, /gpt-5-6-terra/);
  assert.match(policySource, /gpt-5-6-luna/);
  assert.match(providerSource, /json_schema/);
  assert.match(providerSource, /if \(!isKie\(\)\) body\.text/);
  assert.match(providerSource, /does not include OpenAI's text\.format\/json_schema option/);
  assert.match(providerSource, /Required JSON Schema/);
  assert.match(providerSource, /JSON\.stringify\(qcSchema\)/);
  assert.match(providerSource, /normalizeAnalysis/);
  assert.match(providerSource, /HAIRSTYLE_CATALOG/);
});
