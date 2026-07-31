import { HAIR_COLOR_CATALOG, HAIRSTYLE_CATALOG, getColor, getStyle } from "@/lib/hair/catalog";
import { normalizeConsultationTurn, normalizeRecommendationRevision, type ConsultationTurnResult, type RecommendationRevision } from "@/lib/hair/consultation";
import type { AnalysisProvider, AssetId, ConsultationMessage, ConsultationProvider, HairAnalysis, HairColorRecommendation, HairPreferenceProfile, HairstyleRecommendation } from "@/lib/hair/types";
import { bindings, isDemoMode } from "./jobs";
import { describeKieResponseShape, extractKieResponseText } from "./kie-response";
import { ANALYSIS_MODEL_ALLOWLIST, CONSULTATION_MODEL_ALLOWLIST, assertAnalysisModelPolicy, assertConsultationModelPolicy, assertProductionModelPolicy, modelFor, reasoningFor, type ModelPurpose } from "./model-policy";
import { recordProviderFailure, recordProviderSuccess } from "./provider-health";

const KIE_DEFAULT_API_BASE = "https://api.kie.ai";
const KIE_DEFAULT_UPLOAD_BASE = "https://kieai.redpandaai.co";
const kieUploadCache = new WeakMap<ArrayBuffer, Promise<string>>();

function provider() {
  return bindings.AI_PROVIDER?.trim().toLowerCase() || "kie";
}

function isKie() {
  return provider() === "kie";
}

export function generationBatchSize() {
  const fallback = isKie() ? 1 : 3;
  const parsed = Number.parseInt(bindings.GENERATION_CONCURRENCY || "", 10);
  return Number.isFinite(parsed) ? Math.min(3, Math.max(1, parsed)) : fallback;
}

const ANALYSIS_MODEL = () => isKie() ? modelFor("analysis") : bindings.ANALYSIS_MODEL || "gpt-5.6-terra";
const IMAGE_MODEL = () => isKie() ? modelFor("image_edit") : bindings.IMAGE_MODEL || "gpt-image-2-2026-04-21";

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
  required: ["identityPreserved", "hairTargetMatched", "nonHairRegionPreserved", "artifactFree", "hairEdgeQuality", "confidence"],
  properties: {
    identityPreserved: { type: "boolean" },
    hairTargetMatched: { type: "boolean" },
    nonHairRegionPreserved: { type: "boolean" },
    artifactFree: { type: "boolean" },
    hairEdgeQuality: { type: "boolean" },
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

function kieHeaders(headers?: HeadersInit) {
  return {
    Authorization: `Bearer ${bindings.KIE_API_KEY}`,
    ...(headers ?? {}),
  };
}

async function kieRequest(url: string, init: RequestInit, timeout = 150_000) {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: kieHeaders(init.headers),
      signal: AbortSignal.timeout(timeout),
    });
  } catch (error) {
    await recordProviderFailure();
    throw error;
  }
  if (!response.ok) {
    const body = await response.text();
    const code = response.status === 401
      ? "invalid_api_key"
      : response.status === 402
        ? "insufficient_credits"
        : response.status === 429
          ? "rate_limited"
          : body.toLowerCase().includes("moderation")
            ? "moderation_blocked"
            : "model_request_failed";
    console.error("Kie request failed", { endpoint: new URL(url).pathname, status: response.status, code });
    if (response.status === 429 || response.status === 455 || response.status >= 500) await recordProviderFailure();
    throw new Error(code);
  }
  await recordProviderSuccess();
  return response;
}

async function kieJson(url: string, init: RequestInit, timeout?: number) {
  const response = await kieRequest(url, init, timeout);
  const text = await response.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    const events = text.split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .filter((line) => line && line !== "[DONE]");
    const parsedEvents: Record<string, unknown>[] = [];
    for (const event of events) {
      try { parsedEvents.push(JSON.parse(event) as Record<string, unknown>); } catch { /* ignore malformed SSE frames */ }
    }
    if (parsedEvents.length) return { events: parsedEvents };
    throw new Error("model_request_failed");
  }
}

async function uploadKieImage(bytes: ArrayBuffer, contentType: string) {
  const cached = kieUploadCache.get(bytes);
  if (cached) return cached;
  const uploading = (async () => {
    const extension = contentType === "image/jpeg" ? "jpg" : contentType === "image/webp" ? "webp" : "png";
    const filename = `hairform-${crypto.randomUUID()}.${extension}`;
    const uploadBase = bindings.KIE_UPLOAD_BASE || KIE_DEFAULT_UPLOAD_BASE;
    let payload: Record<string, unknown>;
    if (bytes.byteLength <= 2 * 1024 * 1024) {
      payload = await kieJson(`${uploadBase}/api/file-base64-upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base64Data: dataUrl(bytes, contentType),
          uploadPath: "hairform/portraits",
          fileName: filename,
        }),
      });
    } else {
      const form = new FormData();
      form.append("file", new File([bytes], filename, { type: contentType }));
      form.append("uploadPath", "hairform/portraits");
      form.append("fileName", filename);
      payload = await kieJson(`${uploadBase}/api/file-stream-upload`, { method: "POST", body: form });
    }
    const data = payload.data as Record<string, unknown> | undefined;
    const url = typeof data?.downloadUrl === "string" ? data.downloadUrl : typeof data?.fileUrl === "string" ? data.fileUrl : undefined;
    if (!url) throw new Error("image_upload_failed");
    return url;
  })();
  kieUploadCache.set(bytes, uploading);
  try {
    return await uploading;
  } catch (error) {
    kieUploadCache.delete(bytes);
    console.error("Kie portrait upload failed", {
      code: safeErrorCode(error),
      name: error instanceof Error ? error.name : "UnknownError",
    });
    throw error;
  }
}

async function kieResponsesRequest(body: Record<string, unknown>) {
  assertProductionModelPolicy(bindings);
  return kieJson(`${bindings.KIE_API_BASE || KIE_DEFAULT_API_BASE}/codex/v1/responses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, stream: false }),
  });
}

function responsesBody(input: Array<Record<string, unknown>>, name: string, schema: Record<string, unknown>, purpose: Exclude<ModelPurpose, "image_edit">) {
  const body: Record<string, unknown> = {
    model: isKie() ? modelFor(purpose) : ANALYSIS_MODEL(),
    input,
    reasoning: { effort: reasoningFor(purpose) },
  };
  // Kie Terra accepts multimodal Responses input, but its documented contract
  // does not include OpenAI's text.format/json_schema option.
  if (!isKie()) body.text = { format: { type: "json_schema", name, strict: true, schema } };
  return body;
}

function parseEmbeddedJson<T>(value: string): T {
  const cleaned = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("analysis_output_missing");
  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}

function wait(delay: number) {
  return new Promise((resolve) => setTimeout(resolve, delay));
}

async function createKieImageTask(prompt: string, inputUrls: string[]) {
  const payload = await kieJson(`${bindings.KIE_API_BASE || KIE_DEFAULT_API_BASE}/api/v1/jobs/createTask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: IMAGE_MODEL(),
      input: { prompt, input_urls: inputUrls, aspect_ratio: "auto" },
    }),
  });
  const taskId = (payload.data as Record<string, unknown> | undefined)?.taskId;
  if (typeof taskId !== "string" || !taskId) throw new Error("image_task_failed");
  return taskId;
}

export type KieImageTaskResult =
  | { state: "pending" }
  | { state: "failed"; errorCode: "moderation_blocked" | "model_request_failed" }
  | { state: "ready"; bytes: ArrayBuffer; contentType: string };

export async function pollKieImageTask(taskId: string): Promise<KieImageTaskResult> {
  assertProductionModelPolicy(bindings);
  const payload = await kieJson(`${bindings.KIE_API_BASE || KIE_DEFAULT_API_BASE}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, {
    method: "GET",
  });
  const data = payload.data as Record<string, unknown> | undefined;
  const state = typeof data?.state === "string" ? data.state : "";
  if (state === "success") {
    const result = typeof data?.resultJson === "string" ? JSON.parse(data.resultJson) as Record<string, unknown> : data?.resultJson as Record<string, unknown> | undefined;
    const urls = result?.resultUrls;
    const url = Array.isArray(urls) && typeof urls[0] === "string" ? urls[0] : undefined;
    if (!url) throw new Error("image_output_missing");
    return { state: "ready", ...await downloadKieImage(url) };
  }
  if (state === "fail") {
    const message = `${data?.failCode ?? ""} ${data?.failMsg ?? ""}`.toLowerCase();
    return { state: "failed", errorCode: message.includes("moderation") || message.includes("safety") ? "moderation_blocked" : "model_request_failed" };
  }
  return { state: "pending" };
}

async function waitForKieImage(taskId: string) {
  const deadline = Date.now() + 240_000;
  let delay = 2_000;
  while (Date.now() < deadline) {
    const result = await pollKieImageTask(taskId);
    if (result.state === "ready") return result;
    if (result.state === "failed") throw new Error(result.errorCode);
    await wait(delay);
    delay = Math.min(5_000, delay + 500);
  }
  throw new Error("model_request_failed");
}

async function downloadKieImage(url: string) {
  let response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) {
    const payload = await kieJson(`${bindings.KIE_API_BASE || KIE_DEFAULT_API_BASE}/api/v1/common/download-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (typeof payload.data !== "string") throw new Error("image_output_missing");
    response = await fetch(payload.data, { signal: AbortSignal.timeout(60_000) });
  }
  const contentType = response.headers.get("content-type")?.split(";")[0] || "";
  if (!response.ok || !contentType.startsWith("image/")) throw new Error("image_output_missing");
  return { bytes: await response.arrayBuffer(), contentType };
}

function responseText(payload: Record<string, unknown>) {
  try {
    return extractKieResponseText(payload);
  } catch (error) {
    if (isKie()) console.error("Unsupported Kie response envelope", describeKieResponseShape(payload));
    throw error;
  }
}

function chatCompletionText(payload: Record<string, unknown>) {
  const choices = payload.choices;
  if (!Array.isArray(choices)) throw new Error("analysis_output_missing");
  const message = (choices[0] as Record<string, unknown> | undefined)?.message as Record<string, unknown> | undefined;
  if (typeof message?.content !== "string" || !message.content.trim()) throw new Error("analysis_output_missing");
  return message.content;
}

function providerKey(providerId: AnalysisProvider) {
  return providerId === "kie" ? bindings.KIE_API_KEY : providerId === "qwen" ? bindings.QWEN_API_KEY : bindings.GLM_API_KEY;
}

export function isAnalysisProviderConfigured(providerId: AnalysisProvider) {
  return Boolean(providerKey(providerId)?.trim());
}

async function compatibleVisionRequest(providerId: "qwen" | "glm", prompt: string, image: ArrayBuffer, contentType: string) {
  const apiKey = providerKey(providerId);
  if (!apiKey) throw new Error("provider_not_configured");
  const base = providerId === "qwen"
    ? bindings.QWEN_API_BASE || "https://dashscope.aliyuncs.com/compatible-mode/v1"
    : bindings.GLM_API_BASE || "https://open.bigmodel.cn/api/paas/v4";
  const body: Record<string, unknown> = {
    model: ANALYSIS_MODEL_ALLOWLIST[providerId],
    messages: [{ role: "user", content: [
      { type: "image_url", image_url: { url: dataUrl(image, contentType) } },
      { type: "text", text: prompt },
    ] }],
    stream: false,
    temperature: 0.1,
  };
  if (providerId === "qwen") {
    body.enable_thinking = false;
    body.response_format = { type: "json_object" };
  }
  else body.thinking = { type: "disabled" };
  const response = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(150_000),
  });
  if (!response.ok) {
    const errorBody = await response.text();
    const lowered = errorBody.toLowerCase();
    const code = response.status === 401 ? "invalid_api_key"
      : response.status === 429 ? "rate_limited"
        : lowered.includes("safety") || lowered.includes("moderation") ? "moderation_blocked" : "model_request_failed";
    throw new Error(code);
  }
  return await response.json() as Record<string, unknown>;
}

async function consultationRequest(providerId: ConsultationProvider, prompt: string) {
  assertConsultationModelPolicy(providerId, CONSULTATION_MODEL_ALLOWLIST[providerId]);
  if (providerId === "kie") {
    const payload = await kieResponsesRequest({
      model: CONSULTATION_MODEL_ALLOWLIST.kie,
      input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }],
      reasoning: { effort: "low" },
    });
    return responseText(payload);
  }
  const apiKey = bindings.QWEN_API_KEY;
  if (!apiKey) throw new Error("provider_not_configured");
  const base = bindings.QWEN_API_BASE || "https://dashscope.aliyuncs.com/compatible-mode/v1";
  const response = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: CONSULTATION_MODEL_ALLOWLIST.qwen,
      messages: [{ role: "system", content: "You are HAIRFORM's concise hairstyle preference consultant. Return only JSON." }, { role: "user", content: prompt }],
      response_format: { type: "json_object" },
      enable_thinking: false,
      temperature: 0.1,
      stream: false,
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) {
    const body = await response.text();
    const code = response.status === 401 ? "invalid_api_key" : response.status === 429 ? "rate_limited" : body.toLowerCase().includes("safety") ? "moderation_blocked" : "model_request_failed";
    throw new Error(code);
  }
  return chatCompletionText(await response.json() as Record<string, unknown>);
}

const preferenceShape = {
  preferredLengths: ["short", "medium", "long"],
  maintenanceTolerance: "low | medium | high | open",
  fringePreference: "prefer | avoid | open",
  colorChange: "none | subtle | noticeable | open",
  moodIds: ["natural | clean | soft | mature | youthful | sporty | editorial"],
  mustAvoid: ["up to three short Chinese constraints"],
  summaryZh: "one natural Chinese sentence confirming the user's preference",
};

export async function consultHairPreferences(input: {
  provider: ConsultationProvider;
  analysis: HairAnalysis;
  messages: ConsultationMessage[];
  turn: number;
}): Promise<ConsultationTurnResult> {
  if (isDemoMode()) {
    const last = input.messages.filter((message) => message.role === "user").at(-1)?.content ?? "";
    const preferences: HairPreferenceProfile = {
      preferredLengths: last.includes("长") ? ["long"] : last.includes("短") ? ["short"] : last.includes("中") ? ["medium"] : [],
      maintenanceTolerance: /不打理|省事|好打理/.test(last) ? "low" : "open",
      fringePreference: /不要刘海|不喜欢刘海/.test(last) ? "avoid" : /想要刘海|喜欢刘海/.test(last) ? "prefer" : "open",
      colorChange: /不染|原生发色/.test(last) ? "none" : /明显|亮一点/.test(last) ? "noticeable" : "subtle",
      moodIds: /成熟/.test(last) ? ["mature"] : /年轻|减龄/.test(last) ? ["youthful"] : ["natural"],
      mustAvoid: last ? [last.slice(0, 40)] : [],
      summaryZh: last ? `你希望调整为：${last.slice(0, 80)}。` : "你希望建议更贴近日常、容易打理。",
    };
    return { state: input.turn >= 2 ? "ready_to_confirm" : "clarifying", reply: input.turn >= 2 ? "我已经把你的想法整理好了，确认后就按这个方向重新调整。" : "明白了。你对刘海和每天愿意花多少时间打理，还有特别要求吗？", preferences };
  }
  const prompt = `You are a hairstyle preference consultant. You receive only text and structured visual analysis; never request or claim to see a photo. Stay within hairstyle, hair color and daily styling preferences. Do not discuss medicine, hair loss treatment, identity, age, ethnicity, attractiveness or personality.\n\nCurrent structured analysis and recommendations: ${JSON.stringify(input.analysis)}\nConversation so far: ${JSON.stringify(input.messages)}\nThis is user turn ${input.turn} of 2. Ask at most one short, useful Chinese clarification question when a material preference is missing. On turn 2 you must stop asking questions and summarize the best interpretation for confirmation. Return exactly one JSON object with this shape: ${JSON.stringify({ state: "clarifying | ready_to_confirm", reply: "natural Chinese response under 120 characters", preferences: preferenceShape })}. Use state ready_to_confirm when the preferences are sufficiently clear.`;
  const result = parseEmbeddedJson<unknown>(await consultationRequest(input.provider, prompt));
  return normalizeConsultationTurn(result, input.turn >= 2);
}

export async function reviseHairRecommendations(input: {
  provider: ConsultationProvider;
  analysis: HairAnalysis;
  preferences: HairPreferenceProfile;
}): Promise<RecommendationRevision> {
  if (isDemoMode()) {
    return normalizeRecommendationRevision({
      styleTraitIds: input.analysis.styleTraitIds,
      hairstyleSlots: input.analysis.hairstyleSlots,
      colors: input.analysis.colors,
      preferences: input.preferences,
      changeSummary: { zh: "已经按照你确认的长度、打理和风格偏好重新调整建议。", en: "Recommendations updated around your confirmed preferences." },
    }, input.analysis);
  }
  const catalog = HAIRSTYLE_CATALOG.map(({ id, length, fringeId, partId, textures, densities, faceShapes }) => ({ id, length, fringeId, partId, textures, densities, faceShapes }));
  const prompt = `Revise HAIRFORM hairstyle recommendations using confirmed user preferences. Return JSON only. Preserve all visual facts; you may change only styleTraitIds, four hairstyleSlots and two colors. Choose exactly one unique catalog style for each slot best_short, best_medium, best_long and less_suitable. The slot still represents its length even when the user dislikes that length; make it the least conflicting option and explain the preference through rationale and traits. Use only existing enum ids. Do not make medical, identity, age, ethnicity, attractiveness or personality claims.\n\nImmutable analysis facts: ${JSON.stringify({ faceShape: input.analysis.faceShape, hairTexture: input.analysis.hairTexture, hairDensity: input.analysis.hairDensity, hairline: input.analysis.hairline, foreheadRatio: input.analysis.foreheadRatio, skinUndertone: input.analysis.skinUndertone, warnings: input.analysis.warnings })}\nCurrent recommendations: ${JSON.stringify({ styleTraitIds: input.analysis.styleTraitIds, hairstyleSlots: input.analysis.hairstyleSlots, colors: input.analysis.colors })}\nConfirmed preferences: ${JSON.stringify(input.preferences)}\nHairstyle catalog: ${JSON.stringify(catalog)}\nHair color ids: ${JSON.stringify(HAIR_COLOR_CATALOG.map(({ id }) => id))}\nReturn exactly: ${JSON.stringify({ styleTraitIds: ["clean | modern | soft | mature | sporty | editorial"], hairstyleSlots: input.analysis.hairstyleSlots, colors: input.analysis.colors, preferences: preferenceShape, changeSummary: { zh: "natural Chinese summary", en: "short English summary" } })}`;
  return normalizeRecommendationRevision(parseEmbeddedJson<unknown>(await consultationRequest(input.provider, prompt)), input.analysis);
}

export async function testAnalysisProvider(providerId: AnalysisProvider) {
  const started = Date.now();
  if (!isAnalysisProviderConfigured(providerId)) throw new Error("provider_not_configured");
  assertAnalysisModelPolicy(providerId, ANALYSIS_MODEL_ALLOWLIST[providerId]);
  if (providerId === "kie") {
    await kieResponsesRequest({ model: ANALYSIS_MODEL_ALLOWLIST.kie, input: "Return only the word OK.", reasoning: { effort: "low" } });
  } else {
    const base = providerId === "qwen"
      ? bindings.QWEN_API_BASE || "https://dashscope.aliyuncs.com/compatible-mode/v1"
      : bindings.GLM_API_BASE || "https://open.bigmodel.cn/api/paas/v4";
    const response = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${providerKey(providerId)}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: ANALYSIS_MODEL_ALLOWLIST[providerId], messages: [{ role: "user", content: "Return only OK." }], stream: false, max_tokens: 8 }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(response.status === 401 ? "invalid_api_key" : response.status === 429 ? "rate_limited" : "model_request_failed");
  }
  return { latencyMs: Date.now() - started, model: ANALYSIS_MODEL_ALLOWLIST[providerId] };
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

export function normalizeAnalysis(value: HairAnalysis): HairAnalysis {
  const slots = ["best_short", "best_medium", "best_long", "less_suitable"];
  const validStyleIds = new Set(HAIRSTYLE_CATALOG.map((style) => style.id));
  const validColorIds = new Set<string>(HAIR_COLOR_CATALOG.map((color) => color.id));
  const enumChecks: Array<[unknown, string[]]> = [
    [value?.faceShape, ["oval", "round", "square", "heart", "oblong", "diamond", "mixed", "unknown"]],
    [value?.hairTexture, ["straight", "wavy", "curly", "coily", "unknown"]],
    [value?.hairDensity, ["low", "medium", "high", "unknown"]],
    [value?.hairline, ["low", "balanced", "high", "receding", "widows_peak", "unknown"]],
    [value?.foreheadRatio, ["short", "balanced", "long", "unknown"]],
    [value?.skinUndertone, ["warm", "cool", "neutral", "unknown"]],
  ];
  if (enumChecks.some(([candidate, allowed]) => typeof candidate !== "string" || !allowed.includes(candidate))) throw new Error("analysis_schema_invalid");
  if (!value || value.hairstyleSlots?.length !== 4 || value.colors?.length !== 2) throw new Error("analysis_schema_invalid");
  if (!slots.every((slot) => value.hairstyleSlots.filter((item) => item.slot === slot).length === 1)) throw new Error("analysis_slots_invalid");
  if (!value.hairstyleSlots.every((item) => validStyleIds.has(item.styleId))) throw new Error("analysis_style_invalid");
  if (!value.colors.every((item) => validColorIds.has(item.colorId))) throw new Error("analysis_color_invalid");
  return {
    ...value,
    colors: value.colors.map((item) => ({ ...item, swatchHex: getColor(item.colorId).hex })),
  };
}

export async function analyzePortrait(image: ArrayBuffer, contentType: string, analysisProvider: AnalysisProvider = "kie") {
  if (isDemoMode()) return demoAnalysis();
  assertAnalysisModelPolicy(analysisProvider, ANALYSIS_MODEL_ALLOWLIST[analysisProvider]);
  const catalog = HAIRSTYLE_CATALOG.map(({ id, length, fringeId, partId, textures, densities, faceShapes }) => ({ id, length, fringeId, partId, textures, densities, faceShapes }));
  const prompt = `Analyze this single front-facing male portrait for hairstyle recommendation. Return exactly one valid JSON object matching the required JSON Schema, with no Markdown or commentary. First check photo suitability and add only these warning ids when present: side_angle, hat, hairline_occluded, multiple_faces, no_face, too_dark, face_too_small. Add single_front_photo_estimate for an otherwise usable photo. Treat hair density, hairline, forehead and undertone as visual estimates; use unknown whenever the photo does not support a reliable judgment. Select exactly one catalog style for each slot: best short, best medium, best long, and one less suitable comparison. Select two conservative hair colors. Do not infer identity, ethnicity, health, personality, attractiveness, or age. Required JSON Schema: ${JSON.stringify(analysisSchema)}. Catalog: ${JSON.stringify(catalog)}.`;
  const imageUrl = analysisProvider === "kie" ? await uploadKieImage(image, contentType) : dataUrl(image, contentType);
  const requestBody = responsesBody(
    [{ role: "user", content: [{ type: "input_text", text: prompt }, { type: "input_image", image_url: imageUrl }] }],
    "hair_analysis",
    analysisSchema,
    "analysis",
  );
  const payload = analysisProvider === "kie"
    ? await kieResponsesRequest(requestBody)
    : await compatibleVisionRequest(analysisProvider, prompt, image, contentType);
  const raw = analysisProvider === "kie" ? responseText(payload) : chatCompletionText(payload);
  return normalizeAnalysis(parseEmbeddedJson<HairAnalysis>(raw));
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
  if (isDemoMode()) return { bytes: input.image.slice(0), contentType: input.contentType };
  assertProductionModelPolicy(bindings);
  const style = input.analysis.hairstyleSlots.find((item) => item.slot === input.id);
  const colorIndex = input.id === "color_primary" ? 0 : 1;
  const color = input.analysis.colors[colorIndex];
  const prompt = style ? hairstylePrompt(style) : colorPrompt(color);
  if (isKie()) {
    const taskId = await beginKiePortraitEdit(input);
    return await waitForKieImage(taskId);
  }
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
  return { bytes: result.buffer, contentType: "image/png" };
}

export async function beginKiePortraitEdit(input: {
  id: AssetId;
  image: ArrayBuffer;
  contentType: string;
  analysis: HairAnalysis;
  mask?: ArrayBuffer;
}) {
  assertProductionModelPolicy(bindings);
  const style = input.analysis.hairstyleSlots.find((item) => item.slot === input.id);
  const colorIndex = input.id === "color_primary" ? 0 : 1;
  const color = input.analysis.colors[colorIndex];
  const prompt = style ? hairstylePrompt(style) : colorPrompt(color);
  const inputUrl = await uploadKieImage(input.image, input.contentType);
  const maskUrl = input.mask ? await uploadKieImage(input.mask, "image/png") : undefined;
  return createKieImageTask(
    maskUrl
      ? `${prompt} This is a retry. The second input image is a binary edit guide: change only the white hair region and preserve every black region as closely as possible.`
      : prompt,
    maskUrl ? [inputUrl, maskUrl] : [inputUrl],
  );
}

export interface QualityCheckResult {
  identityPreserved: boolean;
  hairTargetMatched: boolean;
  nonHairRegionPreserved: boolean;
  artifactFree: boolean;
  hairEdgeQuality: boolean;
  confidence: number;
}

export async function qualityCheck(input: {
  id: AssetId;
  original: ArrayBuffer;
  output: ArrayBuffer;
  outputType: string;
  originalType: string;
  analysis: HairAnalysis;
}, purpose: "quality" | "quality_escalation" = "quality"): Promise<QualityCheckResult> {
  if (isDemoMode()) return { identityPreserved: true, hairTargetMatched: true, nonHairRegionPreserved: true, artifactFree: true, hairEdgeQuality: true, confidence: 1 };
  assertProductionModelPolicy(bindings);
  const style = input.analysis.hairstyleSlots.find((item) => item.slot === input.id);
  const color = input.id === "color_primary" ? input.analysis.colors[0] : input.id === "color_secondary" ? input.analysis.colors[1] : undefined;
  const target = style ? `${style.styleId}, fringe ${style.fringeId}, part ${style.partId}` : `hair color ${color?.colorId}, unchanged hairstyle`;
  const originalUrl = isKie() ? await uploadKieImage(input.original, input.originalType) : dataUrl(input.original, input.originalType);
  const outputUrl = isKie() ? await uploadKieImage(input.output, input.outputType) : dataUrl(input.output, input.outputType);
  const requestBody = responsesBody(
    [{ role: "user", content: [
        { type: "input_text", text: `Compare the original portrait and edited result. Target: ${target}. Check only same-person visual consistency, preservation of non-hair regions, target hair match, obvious rendering artifacts, and natural hairline/ear/background edges. This is not identity recognition. Return exactly one valid JSON object matching this JSON Schema, with no Markdown or commentary: ${JSON.stringify(qcSchema)}.` },
        { type: "input_image", image_url: originalUrl },
        { type: "input_image", image_url: outputUrl },
      ] }],
    "hair_preview_qc",
    qcSchema,
    purpose,
  );
  const payload = isKie()
    ? await kieResponsesRequest(requestBody)
    : await (await openAIRequest("/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    })).json() as Record<string, unknown>;
  return parseEmbeddedJson<QualityCheckResult>(responseText(payload));
}

export function safeErrorCode(error: unknown) {
  const value = error instanceof Error ? error.message : "unknown_error";
  return ["invalid_api_key", "provider_not_configured", "insufficient_credits", "service_paused_low_credit", "service_temporarily_unavailable", "model_policy_error", "model_daily_limit", "analysis_call_limit", "image_call_limit_reached", "quality_call_limit", "quality_check_failed", "quality_service_failed", "rate_limited", "moderation_blocked", "analysis_schema_invalid", "analysis_slots_invalid", "analysis_style_invalid", "analysis_color_invalid", "analysis_output_missing", "image_output_missing", "image_upload_failed", "image_task_failed", "model_request_failed"].includes(value) ? value : "generation_failed";
}
