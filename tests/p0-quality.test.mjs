import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assessFaceLandmarks, estimateSharpness } from "../lib/client/photo-quality.ts";
import { withPngText } from "../lib/client/image-metadata.ts";
import { PREVIEW_QUALITY_METRICS, scorePreviewQuality } from "../lib/hair/preview-quality.ts";

test("photo precheck estimates pose and framing from normalized landmarks", () => {
  const points = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  points[20] = { x: 0.3, y: 0.2, z: 0 };
  points[21] = { x: 0.7, y: 0.8, z: 0 };
  points[33] = { x: 0.4, y: 0.42, z: 0 };
  points[263] = { x: 0.6, y: 0.42, z: 0 };
  points[1] = { x: 0.5, y: 0.52, z: 0 };
  const result = assessFaceLandmarks(points);
  assert.ok(result);
  assert.equal(Math.round(result.rollDegrees), 0);
  assert.equal(Math.round(result.yawRatio * 100), 0);
  assert.equal(Math.round(result.coverage * 100), 24);
});

test("sharpness score separates a flat image from high-frequency detail", () => {
  const flat = new Float32Array(64).fill(120);
  const detailed = Float32Array.from({ length: 64 }, (_, index) => index % 2 ? 255 : 0);
  assert.equal(estimateSharpness(flat, 8, 8), 0);
  assert.ok(estimateSharpness(detailed, 8, 8) > 1000);
});

test("downloadable PNG receives a machine-readable AI content marker", async () => {
  const png = new Uint8Array(33);
  png.set([137, 80, 78, 71, 13, 10, 26, 10]);
  new DataView(png.buffer).setUint32(8, 13, false);
  png.set(new TextEncoder().encode("IHDR"), 12);
  const tagged = new Uint8Array(await (await withPngText(new Blob([png], { type: "image/png" }), { AI_Generated: "true", Generator: "HAIRFORM" })).arrayBuffer());
  const text = new TextDecoder().decode(tagged);
  assert.match(text, /AI_Generated\0true/);
  assert.match(text, /Generator\0HAIRFORM/);
});

test("preview release score fails closed when a required metric is missing", () => {
  const complete = PREVIEW_QUALITY_METRICS.map((metric) => ({ metric, score: 0.9 }));
  assert.equal(scorePreviewQuality(complete).passed, true);
  assert.equal(scorePreviewQuality(complete.filter((item) => item.metric !== "artifact_free")).passed, false);
});

test("web UI exposes separate authorization, processing and AI content disclosures", async () => {
  const [app, createRoute] = await Promise.all([
    readFile(new URL("../app/HairApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/v1/hair-jobs/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(app, /照片属于本人，或已获得照片中人物的明确授权/);
  assert.match(app, /不将照片用于训练/);
  assert.match(app, /AI 生成发型效果/);
  assert.match(app, /生成期间不能再修改建议/);
  assert.match(createRoute, /consentVersion !== PHOTO_CONSENT_VERSION/);
  assert.match(createRoute, /consent_required/);
});
