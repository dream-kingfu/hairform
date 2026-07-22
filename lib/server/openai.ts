import { HAIR_COLOR_CATALOG, HAIRSTYLE_CATALOG, getColor, getStyle } from "@/lib/hair/catalog";
import type { AssetId, HairAnalysis, HairColorRecommendation, HairstyleRecommendation } from "@/lib/hair/types";
import { bindings, isDemoMode } from "./jobs";

const ANALYSIS_MODEL = () => bindings.ANALYSIS_MODEL || "gpt-5.6-terra";
const IMAGE_MODEL = () => bindings.IMAGE_MODEL || "gpt-image-2-2026-04-21";

const analysisSchema = {
  type: "object",
  additionalProperties: false,
  required: ["faceShape", "hairTexture", "hairDensity", "hairline", "foreheadRatio", "skinUndertone", "styleTraitIds", "hairstyleSlots", "colors", "warnings"],
  properties: {
    faceShape: { type: "string", enum: ["oval", "round", "square", "heart", "oblong", "diamond", "mixed", "unknown"] },
    hairTexture: { type: "string", enum: ["straight", "wavy", "curly", "coily", "unknown"] },
    hairDensity: { type: "string", enum: ["low", "medium", "high", "unknown"] },
    hairline: { type: "string", enum: ["low", "balanced", "high", "receding", "widows_peak", "unknown"] },
    foreheadRatio: { type: "string", enum: ["short", "balanced", "long", "unknown"] },
    skinUndertone: { type: "string", enum: ["warm", "cool", "neutral", "unknown"] },
    styleTraitIds: { type: "array", maxItems: 3, items: { type: "string", enum: ["clean", "modern", "soft", "mature", "sporty", "editorial"] } },
    hairstyleSlots: {
      type: "array", minItems: 4, maxItems: 4,
      items: {
        type: "object", additionalProperties: false,
        required: ["slot", "styleId", "fringeId", "partId", "rationaleIds", "promptTraits"],
        properties: {
          slot: { type: "string", enum: ["best_short", "best_medium", "best_long", "less_suitable"] },
          styleId: { type: "string", enum: HAIRSTYLE_CATALOG.map((style) => style.id) },
          fringeId: { type: "string", enum: ["none", "soft_fringe", "french", "upswept", "comma", "side_swept", "curtain"] },
          partId: { type: "string", enum: ["natural", "side", "middle", "back", "none"] },
          rationaleIds: { type: "array", maxItems: 3, items: { type: "string", enum: ["balances_face", "adds_height", "softens_angles", "frames_forehead", "supports_density", "easy_care", "may_widen_face", "may_expose_hairline", "needs_density", "high_maintenance"] } },
          promptTraits: { type: "array", maxItems: 4, items: { type: "string" } },
        },
      },
    },
    colors: {
      type: "array", minItems: 2, maxItems: 2,
      items: {
        type: "object", additionalProperties: false,
        required: ["colorId", "swatchHex", "promptTraits"],
        properties: {
          colorId: { type: "string", enum: HAIR_COLOR_CATALOG.map((color) => color.id) },
          swatchHex: { type: "string" },
          level: { type: "integer", minimum: 1, maximum: 10 },
          promptTraits: { type: "array", maxItems: 4, items: { type: "string" } },
        },
      },
    },
    warnings: { type: "array", maxItems: 4, items: { type: "string", enum: ["side_angle", "hat", "hairline_occluded", "multiple_faces", "no_face", "too_dark", "face_too_small", "single_front_photo_estimate"] } },
  },
} as const;

const qcSchema = {
  type: "object", additionalProperties: false,
  required: ["identityPreserved", "hairTargetMatched", "nonHairRegionPreserved", "artifactFree", "confidence"],
  properties: {
    identityPreserved: { type: "boolean" },
    hairTargetMatched: { type: "boolean" },
    nonHairRegionPreserved: { type: "boolean" },
    artifactFree: { type: "boolean" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
} as const;

function arrayBufferToBase64(bytes: ArrayBuffer) {
  const source = new Uint8Array(bytes);
  let binary = "";
  for (let index = 0; index < source.length; index += 0x8000) {
    binary += String.fromCharCode(...source.subarray(index, Math.min(index + 0x8000, source.length)));
  }
  return btoa(binary);
}

function dataUrl(bytes: ArrayBuffer, contentType: string) {
  return `data:${contentType};base64,${arrayBufferToBase64(bytes)}`;
}

async function openAIRequest(path: string, init: RequestInit) {
  const response = await fetch(`https://api.openai.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${bindings.OPENAI_API_KEY}`,
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(150_000),
  });
  if (!response.ok) {
    const body = await response.text();
    const code = response.status === 429 ? "rate_limited" : body.includes("moderation") ? "moderation_blocked" : "model_request_failed";
    throw new Error(code);
  }
  return response;
}

function responseText(payload: Record<string, unknown>) {
  if (typeof payload.output_text === "string") return payload.output_text;
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output as Array<Record<string, unknown>>) {
    const content = Array.isArray(item.content) ? item.content : [];
    for (const part of content as Array<Record<string, unknown>>) {
      if (part.type === "output_text" && typeof part.text === "string") return part.text;
    }
  }
  throw new Error("analysis_output_missing");
}

export function demoAnalysis(): HairAnalysis {
  return {
    faceShape: "oval",
    hairTexture: "straight",
    hairDensity: "medium",
    hairline: "balanced",
    foreheadRatio: "balanced",
    skinUndertone: "neutral",
    styleTraitIds: ["clean", "modern", "soft"],
    hairstyleSlots: [
      { slot: "best_short", styleId: "textured_crop", fringeId: "soft_fringe", partId: "natural", rationaleIds: ["balances_face", "easy_care"], promptTraits: ["airy texture", "clean sides"] },
      { slot: "best_medium", styleId: "soft_side_part", fringeId: "side_swept", partId: "side", rationaleIds: ["balances_face", "frames_forehead"], promptTraits: ["soft root volume", "natural movement"] },
      { slot: "best_long", styleId: "bro_flow", fringeId: "none", partId: "back", rationaleIds: ["softens_angles", "supports_density"], promptTraits: ["touchable movement", "controlled length"] },
      { slot: "less_suitable", styleId: "high_volume_pompadour", fringeId: "upswept", partId: "back", rationaleIds: ["high_maintenance", "needs_density"], promptTraits: ["pronounced height", "tight sides"] },
    ],
    colors: [
      { colorId: "black_tea", swatchHex: "#30251f", level: 4, promptTraits: ["deep neutral brown", "natural dimension"] },
      { colorId: "warm_tea", swatchHex: "#624638", level: 6, promptTraits: ["restrained warm tone", "soft shine"] },
    ],
    warnings: ["single_front_photo_estimate"],
  };
}

function normalizeAnalysis(value: HairAnalysis): HairAnalysis {
  const slots = ["best_short", "best_medium", "best_long", "less_suitable"];
  const validStyleIds = new Set(HAIRSTYLE_CATALOG.map((style) => style.id));
  const validColorIds = new Set<string>(HAIR_COLOR_CATALOG.map((color) => color.id));
  if (!value || value.hairstyleSlots?.length !== 4 || value.colors?.length !== 2) throw new Error("analysis_schema_invalid");
  if (!slots.every((slot) => value.hairstyleSlots.some((item) => item.slot === slot))) throw new Error("analysis_slots_invalid");
  if (!value.hairstyleSlots.every((item) => validStyleIds.has(item.styleId))) throw new Error("analysis_style_invalid");
  if (!value.colors.every((item) => validColorIds.has(item.colorId))) throw new Error("analysis_color_invalid");
  return {
    ...value,
    colors: value.colors.map((item) => ({ ...item, swatchHex: getColor(item.colorId).hex })),
  };
}

export async function analyzePortrait(image: ArrayBuffer, contentType: string) {
  if (isDemoMode()) return demoAnalysis();
  const catalog = HAIRSTYLE_CATALOG.map(({ id, length, fringeId, partId, textures, densities, faceShapes }) => ({ id, length, fringeId, partId, textures, densities, faceShapes }));
  const prompt = `Analyze this single front-facing male portrait for hairstyle recommendation. Return only the requested structured data. First check photo suitability and add only these warning ids when present: side_angle, hat, hairline_occluded, multiple_faces, no_face, too_dark, face_too_small. Add single_front_photo_estimate for an otherwise usable photo. Treat hair density, hairline, forehead and undertone as visual estimates; use unknown whenever the photo does not support a reliable judgment. Select exactly one catalog style for each slot: best short, best medium, best long, and one less suitable comparison. Select two conservative hair colors. Do not infer identity, ethnicity, health, personality, attractiveness, or age. Catalog: ${JSON.stringify(catalog)}.`;
  const response = await openAIRequest("/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: ANALYSIS_MODEL(),
      input: [{ role: "user", content: [{ type: "input_text", text: prompt }, { type: "input_image", image_url: dataUrl(image, contentType) }] }],
      text: { format: { type: "json_schema", name: "hair_analysis", strict: true, schema: analysisSchema } },
    }),
  });
  const payload = await response.json() as Record<string, unknown>;
  return normalizeAnalysis(JSON.parse(responseText(payload)) as HairAnalysis);
}

function sharedEditRules() {
  return "Keep exactly the same person, face geometry, facial features, skin tone, eyebrows, facial hair, expression, pose, camera angle, clothing, lighting and background. Edit only the scalp hair. Preserve a natural hairline and realistic strand direction. No text, labels, collage, extra person, duplicated features, wig look, beauty retouching or facial changes.";
}

function hairstylePrompt(recommendation: HairstyleRecommendation) {
  const style = getStyle(recommendation.styleId);
  const caution = recommendation.slot === "less_suitable" ? "This is an intentionally less suitable comparison, but it must still look realistic and respectful." : "Make the result flattering, wearable and salon-realistic.";
  return `${sharedEditRules()} Change the hairstyle to ${style.prompt}. Additional traits: ${recommendation.promptTraits.join(", ")}. ${caution}`;
}

function colorPrompt(recommendation: HairColorRecommendation) {
  const color = getColor(recommendation.colorId);
  return `${sharedEditRules()} Keep the existing haircut, length, texture, fringe, part and hairline completely unchanged. Recolor only the existing scalp hair to ${color.prompt}. Do not recolor eyebrows, beard, skin, clothes or background. Additional traits: ${recommendation.promptTraits.join(", ")}.`;
}

export async function editPortrait(input: {
  id: AssetId;
  image: ArrayBuffer;
  contentType: string;
  analysis: HairAnalysis;
  mask?: ArrayBuffer;
}) {
  if (isDemoMode()) return input.image.slice(0);
  const style = input.analysis.hairstyleSlots.find((item) => item.slot === input.id);
  const colorIndex = input.id === "color_primary" ? 0 : 1;
  const color = input.analysis.colors[colorIndex];
  const prompt = style ? hairstylePrompt(style) : colorPrompt(color);
  const form = new FormData();
  form.append("model", IMAGE_MODEL());
  form.append("image", new File([input.image], "portrait.png", { type: input.contentType }));
  if (input.mask) form.append("mask", new File([input.mask], "hair-mask.png", { type: "image/png" }));
  form.append("prompt", prompt);
  form.append("size", "1024x1536");
  form.append("quality", "medium");
  form.append("output_format", "png");
  form.append("moderation", "auto");
  const response = await openAIRequest("/images/edits", { method: "POST", body: form });
  const payload = await response.json() as { data?: Array<{ b64_json?: string }> };
  const encoded = payload.data?.[0]?.b64_json;
  if (!encoded) throw new Error("image_output_missing");
  const binary = atob(encoded);
  const result = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) result[index] = binary.charCodeAt(index);
  return result.buffer;
}

export async function qualityCheck(input: {
  id: AssetId;
  original: ArrayBuffer;
  output: ArrayBuffer;
  originalType: string;
  analysis: HairAnalysis;
}) {
  if (isDemoMode()) return true;
  const style = input.analysis.hairstyleSlots.find((item) => item.slot === input.id);
  const color = input.id === "color_primary" ? input.analysis.colors[0] : input.id === "color_secondary" ? input.analysis.colors[1] : undefined;
  const target = style ? `${style.styleId}, fringe ${style.fringeId}, part ${style.partId}` : `hair color ${color?.colorId}, unchanged hairstyle`;
  const response = await openAIRequest("/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: ANALYSIS_MODEL(),
      input: [{ role: "user", content: [
        { type: "input_text", text: `Compare the original portrait and edited result. Target: ${target}. Check only same-person visual consistency, preservation of non-hair regions, target hair match, and obvious rendering artifacts. This is not identity recognition.` },
        { type: "input_image", image_url: dataUrl(input.original, input.originalType) },
        { type: "input_image", image_url: dataUrl(input.output, "image/png") },
      ] }],
      text: { format: { type: "json_schema", name: "hair_preview_qc", strict: true, schema: qcSchema } },
    }),
  });
  const payload = await response.json() as Record<string, unknown>;
  const qc = JSON.parse(responseText(payload)) as { identityPreserved: boolean; hairTargetMatched: boolean; nonHairRegionPreserved: boolean; artifactFree: boolean; confidence: number };
  return qc.identityPreserved && qc.hairTargetMatched && qc.nonHairRegionPreserved && qc.artifactFree && qc.confidence >= 0.72;
}

export function safeErrorCode(error: unknown) {
  const value = error instanceof Error ? error.message : "unknown_error";
  return ["rate_limited", "moderation_blocked", "analysis_schema_invalid", "analysis_slots_invalid", "analysis_style_invalid", "analysis_color_invalid", "analysis_output_missing", "image_output_missing", "model_request_failed"].includes(value) ? value : "generation_failed";
}
