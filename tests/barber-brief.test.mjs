import assert from "node:assert/strict";
import test from "node:test";
import { BARBER_BRIEF_CATALOG, barberBriefCopyText, buildBarberBrief } from "../lib/hair/barber-brief.ts";

const STYLE_IDS = [
  "textured_crop", "french_crop", "crew_cut", "ivy_league", "short_quiff",
  "comma_hair", "soft_side_part", "curtain", "layered_two_block", "slick_back",
  "bro_flow", "layered_wolf", "long_layers", "buzz_cut", "high_volume_pompadour",
];

function analysis(overrides = {}) {
  return {
    faceShape: "oval",
    hairTexture: "straight",
    hairDensity: "medium",
    hairline: "balanced",
    foreheadRatio: "balanced",
    skinUndertone: "neutral",
    styleTraitIds: ["clean"],
    hairstyleSlots: [],
    colors: [],
    warnings: [],
    ...overrides,
  };
}

function recommendation(styleId) {
  return { slot: "best_short", styleId, fringeId: "soft_fringe", partId: "natural", rationaleIds: [], promptTraits: [] };
}

const labels = {
  style: { zh: "自然后梳中长发", en: "Bro Flow" },
  fringe: { zh: "轻薄刘海", en: "Soft Fringe" },
  part: { zh: "自然分缝", en: "Natural Part" },
};

test("covers all 15 hairstyle catalog entries with complete bilingual barber specs", () => {
  assert.deepEqual(Object.keys(BARBER_BRIEF_CATALOG).sort(), [...STYLE_IDS].sort());
  for (const styleId of STYLE_IDS) {
    const spec = BARBER_BRIEF_CATALOG[styleId];
    assert.equal(spec.styleId, styleId);
    for (const key of ["top", "sidesBack", "layersTexture", "baseThinning", "styling", "avoid"]) {
      assert.ok(spec[key].zh.trim(), `${styleId}.${key}.zh`);
      assert.ok(spec[key].en.trim(), `${styleId}.${key}.en`);
    }
    assert.ok(spec.avoidShortZh.trim());
  }
});

test("builds concise copy and six execution rows without model-authored prose", () => {
  for (const styleId of STYLE_IDS) {
    const brief = buildBarberBrief(analysis(), recommendation(styleId), labels);
    assert.equal(brief.rows.length, 6);
    assert.ok(brief.spokenZh.length <= 90, `${styleId} spoken copy is ${brief.spokenZh.length} characters`);
    assert.match(brief.spokenZh, /请按参考图剪成/);
    assert.match(barberBriefCopyText(brief), /现场确认：/);
  }
});

test("personalizes density, texture and hairline safeguards deterministically", () => {
  const lowDensity = buildBarberBrief(analysis({ hairDensity: "low" }), recommendation("textured_crop"), labels);
  assert.match(lowDensity.rows.find((row) => row.id === "thinning").value.zh, /保留整体重量/);

  const highDensity = buildBarberBrief(analysis({ hairDensity: "high" }), recommendation("textured_crop"), labels);
  assert.match(highDensity.rows.find((row) => row.id === "thinning").value.zh, /受控的内部去量/);

  const curly = buildBarberBrief(analysis({ hairTexture: "curly" }), recommendation("curtain"), labels);
  assert.match(curly.rows.find((row) => row.id === "layers_texture").value.zh, /预留卷缩/);

  const receding = buildBarberBrief(analysis({ hairline: "receding" }), recommendation("crew_cut"), labels);
  assert.match(receding.avoid.zh, /不强行画直发际线/);

  const unclear = buildBarberBrief(analysis({ hairTexture: "unknown", hairDensity: "unknown", hairline: "unknown" }), recommendation("soft_side_part"), labels);
  assert.match(barberBriefCopyText(unclear), /无法确认|无法可靠判断/);
});

test("rejects hairstyle ids that are not in the fixed catalog", () => {
  assert.throws(() => buildBarberBrief(analysis(), recommendation("invented_style"), labels), /unknown_barber_style/);
});
