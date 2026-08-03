import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../lib/hair/consultation.ts", import.meta.url), "utf8");

test("forces confirmation on the second consultation turn", () => {
  assert.match(source, /forceReady \? "ready_to_confirm"/);
});

test("revision changes recommendations while preserving visual facts", () => {
  const merge = source.slice(source.indexOf("export function mergeRevision"));
  assert.match(merge, /\.\.\.current/);
  assert.match(merge, /styleTraitIds: revision\.styleTraitIds/);
  assert.match(merge, /hairstyleSlots: revision\.hairstyleSlots/);
  assert.match(merge, /colors: revision\.colors/);
  assert.doesNotMatch(merge, /faceShape:|hairTexture:|hairDensity:|hairline:|skinUndertone:/);
});

test("rejects catalog ids invented by the model", () => {
  assert.match(source, /validStyleIds\.has\(item\.styleId\)/);
  assert.match(source, /throw new Error\("analysis_style_invalid"\)/);
  assert.match(source, /validColorIds\.has\(item\.colorId\)/);
});
