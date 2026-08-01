import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("contains the finished HAIRFORM experience", async () => {
  const [app, layout] = await Promise.all([
    readFile(new URL("../app/HairApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(layout, /型格 HAIRFORM/);
  assert.match(app, /先看见/);
  assert.match(app, /上传一张清晰正面照/);
  assert.match(app, /24H PRIVATE/);
  assert.match(app, /先选后生成/);
  assert.match(app, /选这款发色/);
  assert.match(app, /完整真人预览图已排好/);
  assert.doesNotMatch(`${app}\n${layout}`, /codex-preview|SkeletonPreview|Your site is taking shape/);
});

test("exposes the web-only conversational revision controls", async () => {
  const [app, admin, styles] = await Promise.all([
    readFile(new URL("../app/HairApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/AdminApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(app, /V0\.6\.2 · CONSULT THEN GENERATE/);
  assert.match(app, /不太满意？告诉我想改哪里/);
  assert.match(app, /确认按这个调整/);
  assert.match(app, /保留原建议/);
  assert.match(app, /长度|刘海|打理难度|风格|发色/);
  assert.match(admin, /沟通改建议/);
  assert.match(admin, /GPT \/ Kie Terra/);
  assert.match(admin, /千问 Qwen/);
  assert.match(styles, /consultation-panel/);
});

test("exposes text-only domestic hairstyle inspiration on positive web cards", async () => {
  const [app, inspiration, report] = await Promise.all([
    readFile(new URL("../app/HairApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/hair/inspiration.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/client/report.ts", import.meta.url), "utf8"),
  ]);
  assert.match(app, /真实发型灵感/);
  assert.match(app, /去原帖看效果/);
  assert.match(app, /recommendation\.slot !== "less_suitable"/);
  assert.match(inspiration, /www\.douyin\.com/);
  assert.match(inspiration, /www\.xiaohongshu\.com/);
  assert.doesNotMatch(inspiration, /\b(?:imageUrl|thumbnailUrl|noteText|followers|comments)\s*:/);
  assert.doesNotMatch(report, /HairInspiration|真实发型灵感/);
});

test("keeps model output separate from deterministic labels", async () => {
  const [catalog, labels, report, hosting, page] = await Promise.all([
    readFile(new URL("../lib/hair/catalog.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/hair/labels.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/client/report.ts", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);
  const styleIds = [...catalog.matchAll(/\{ id: "([a-z_]+)", zh:/g)].map((match) => match[1]);
  assert.ok(styleIds.length >= 15);
  assert.match(labels, /谨慎选择/);
  assert.match(labels, /Less Suitable/);
  assert.match(report, /const WIDTH = 2160/);
  assert.match(report, /const HEIGHT = 3840/);
  assert.match(hosting, /"d1": "DB"/);
  assert.match(hosting, /"r2": "HAIR_ASSETS"/);
  assert.doesNotMatch(page, /codex-preview|_sites-preview/);
});

test("enforces public generation budgets without storing raw IP addresses", async () => {
  const [rateLimit, createRoute, retryRoute, processRoute, generateRoute, processor, schema, migration] = await Promise.all([
    readFile(new URL("../lib/server/rate-limit.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/v1/hair-jobs/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/v1/hair-jobs/[jobId]/retry/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/v1/hair-jobs/[jobId]/process/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/v1/hair-jobs/[jobId]/generate/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/server/processor.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0003_single_preview_policy.sql", import.meta.url), "utf8"),
  ]);
  assert.match(rateLimit, /MAX_JOBS_PER_HOUR, 2/);
  assert.match(rateLimit, /MAX_JOBS_PER_DAY, 5/);
  assert.match(rateLimit, /MAX_RETRIES_PER_HOUR, 6/);
  assert.match(rateLimit, /MAX_GLOBAL_JOBS_PER_DAY, 100/);
  assert.match(rateLimit, /MAX_IMAGE_CALLS_PER_DAY/);
  assert.match(rateLimit, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(rateLimit, /Retry-After/);
  assert.match(createRoute, /consumeNewJobLimit/);
  assert.match(retryRoute, /consumeRetryLimit/);
  assert.match(processRoute, /claimInitialJob/);
  assert.match(generateRoute, /model_not_allowed/);
  assert.match(generateRoute, /selection_locked/);
  assert.match(processor, /MODEL_POLICY\.imageEdit\.perJobLimit/);
  assert.match(schema, /rate_limit_buckets/);
  assert.match(schema, /service_state/);
  assert.match(migration, /image_calls/);
});

test("ships a deterministic, downloadable barber brief without changing the main report", async () => {
  const [app, brief, card, report] = await Promise.all([
    readFile(new URL("../app/HairApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/hair/barber-brief.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/client/barber-brief-card.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/client/report.ts", import.meta.url), "utf8"),
  ]);
  assert.match(app, /给理发师看/);
  assert.match(app, /role="dialog"/);
  assert.match(app, /barberBriefCopyText/);
  assert.match(app, /selectedStyleId/);
  assert.match(brief, /BARBER_BRIEF_CATALOG/);
  assert.match(card, /const WIDTH = 1080/);
  assert.match(card, /const HEIGHT = 1920/);
  assert.match(report, /const WIDTH = 2160/);
  assert.match(report, /const HEIGHT = 3840/);
  assert.doesNotMatch(brief, /openai|image generation|promptTraits/);
});

test("exposes native mini-program presentation and split report uploads", async () => {
  const [presentation, reportAssets, jobs, types] = await Promise.all([
    readFile(new URL("../lib/hair/presentation.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/v1/hair-jobs/[jobId]/report-assets/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/server/jobs.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/hair/types.ts", import.meta.url), "utf8"),
  ]);
  assert.match(presentation, /buildHairPresentation/);
  assert.match(presentation, /buildBarberBrief/);
  assert.match(reportAssets, /kind !== "report" && kind !== "preview"/);
  assert.match(reportAssets, /REPORT_MAX_SIZE/);
  assert.match(jobs, /presentation: analysis \? buildHairPresentation/);
  assert.match(types, /HairJobPresentation/);
});
