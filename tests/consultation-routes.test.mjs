import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("consultation routes are authenticated, bounded, and text only", async () => {
  const [messages, confirm, cancel, openai] = await Promise.all([
    readFile(new URL("../app/api/v1/hair-jobs/[jobId]/consultation/messages/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/v1/hair-jobs/[jobId]/consultation/confirm/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/v1/hair-jobs/[jobId]/consultation/cancel/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/server/openai.ts", import.meta.url), "utf8"),
  ]);
  for (const route of [messages, confirm, cancel]) assert.match(route, /authorizeJob/);
  assert.match(messages, /message\.length > 500/);
  assert.match(messages, /consultation_round_turns >= 2/);
  assert.match(confirm, /revision_calls >= 2/);
  assert.match(confirm, /mergeRevision/);
  const consultationSource = openai.slice(openai.indexOf("export async function consultHairPreferences"), openai.indexOf("export async function testAnalysisProvider"));
  assert.doesNotMatch(consultationSource, /input_image|uploadKieImage|dataUrl\(/);
  assert.match(consultationSource, /never request or claim to see a photo/);
});

test("generation cannot race an unfinished consultation", async () => {
  const [route, jobs] = await Promise.all([
    readFile(new URL("../app/api/v1/hair-jobs/[jobId]/generate/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/server/jobs.ts", import.meta.url), "utf8"),
  ]);
  assert.match(route, /consultation_in_progress/);
  assert.match(jobs, /consultation_state NOT IN \('clarifying', 'ready_to_confirm', 'revising'\)/);
});

test("only a completed revision consumes one of the two modification slots", async () => {
  const jobs = await readFile(new URL("../lib/server/jobs.ts", import.meta.url), "utf8");
  const begin = jobs.slice(jobs.indexOf("export async function beginConsultationRevision"), jobs.indexOf("export async function completeConsultationRevision"));
  const complete = jobs.slice(jobs.indexOf("export async function completeConsultationRevision"), jobs.indexOf("export async function failConsultationWork"));
  assert.doesNotMatch(begin, /revision_calls = revision_calls \+ 1/);
  assert.match(complete, /revision_calls = revision_calls \+ 1/);
  assert.match(complete, /report_key = NULL, preview_key = NULL/);
});
