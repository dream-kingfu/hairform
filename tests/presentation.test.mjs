import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("covers every fixed style and color in the native presentation contract", async () => {
  const [presentation, catalog, brief] = await Promise.all([
    readFile(new URL("../lib/hair/presentation.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/hair/catalog.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/hair/barber-brief.ts", import.meta.url), "utf8"),
  ]);
  const colorStart = catalog.indexOf("HAIR_COLOR_CATALOG");
  const styleIds = [...catalog.slice(0, colorStart).matchAll(/\{ id: "([a-z_]+)", zh:/g)].map((match) => match[1]);
  const colorSection = catalog.slice(colorStart);
  const colorIds = [...colorSection.matchAll(/\{ id: "([a-z_]+)", zh:/g)].map((match) => match[1]);
  assert.equal(styleIds.length, 15);
  assert.equal(colorIds.length, 6);
  styleIds.forEach((id) => assert.match(brief, new RegExp(`\\b${id}: \\{`)));
  for (const token of ["FACE_LABELS", "TEXTURE_LABELS", "DENSITY_LABELS", "HAIRLINE_LABELS", "FOREHEAD_LABELS", "UNDERTONE_LABELS", "SLOT_LABELS", "FRINGE_LABELS", "PART_LABELS", "buildBarberBrief"]) {
    assert.match(presentation, new RegExp(token));
  }
  assert.match(presentation, /recommendation\.slot === "less_suitable" \? undefined/);
  assert.match(presentation, /assetId: index === 0 \? "color_primary"/);
  assert.match(presentation, /styleAdvice/);
  assert.match(presentation, /colorAdvice/);
  assert.match(presentation, /consultantSummary/);
});
