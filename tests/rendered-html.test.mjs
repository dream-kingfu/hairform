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
  assert.doesNotMatch(`${app}\n${layout}`, /codex-preview|SkeletonPreview|Your site is taking shape/);
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
