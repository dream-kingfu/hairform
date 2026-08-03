import { HAIR_COLOR_CATALOG, HAIRSTYLE_CATALOG, getColor } from "./catalog";
import type {
  BilingualLabel,
  HairAnalysis,
  HairColorRecommendation,
  HairPreferenceProfile,
  HairstyleRecommendation,
} from "./types";

export interface ConsultationTurnResult {
  state: "clarifying" | "ready_to_confirm";
  reply: string;
  preferences: HairPreferenceProfile;
}

export interface RecommendationRevision {
  styleTraitIds: string[];
  hairstyleSlots: HairstyleRecommendation[];
  colors: HairColorRecommendation[];
  preferences: HairPreferenceProfile;
  changeSummary: BilingualLabel;
}

const LENGTHS = new Set(["short", "medium", "long"]);
const MAINTENANCE = new Set(["low", "medium", "high", "open"]);
const FRINGE = new Set(["prefer", "avoid", "open"]);
const COLOR_CHANGE = new Set(["none", "subtle", "noticeable", "open"]);
const MOODS = new Set(["natural", "clean", "soft", "mature", "youthful", "sporty", "editorial"]);
const STYLE_TRAITS = new Set(["clean", "modern", "soft", "mature", "sporty", "editorial"]);
const SLOTS = ["best_short", "best_medium", "best_long", "less_suitable"];
const FRINGES = new Set(["none", "soft_fringe", "french", "upswept", "comma", "side_swept", "curtain"]);
const PARTS = new Set(["natural", "side", "middle", "back", "none"]);
const RATIONALES = new Set(["balances_face", "adds_height", "softens_angles", "frames_forehead", "supports_density", "easy_care", "may_widen_face", "may_expose_hairline", "needs_density", "high_maintenance"]);

function cleanText(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim().slice(0, 240) : fallback;
}

function enumValue<T extends string>(value: unknown, allowed: Set<string>, fallback: T): T {
  return typeof value === "string" && allowed.has(value) ? value as T : fallback;
}

export function emptyPreferenceProfile(): HairPreferenceProfile {
  return {
    preferredLengths: [],
    maintenanceTolerance: "open",
    fringePreference: "open",
    colorChange: "open",
    moodIds: [],
    mustAvoid: [],
    summaryZh: "还没有需要调整的明确偏好。",
  };
}

export function normalizePreferenceProfile(value: unknown): HairPreferenceProfile {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const preferredLengths = Array.isArray(input.preferredLengths)
    ? [...new Set(input.preferredLengths.filter((item): item is "short" | "medium" | "long" => typeof item === "string" && LENGTHS.has(item)))].slice(0, 3)
    : [];
  const moodIds = Array.isArray(input.moodIds)
    ? [...new Set(input.moodIds.filter((item): item is HairPreferenceProfile["moodIds"][number] => typeof item === "string" && MOODS.has(item)))].slice(0, 3)
    : [];
  const mustAvoid = Array.isArray(input.mustAvoid)
    ? input.mustAvoid.map((item) => cleanText(item)).filter(Boolean).slice(0, 3)
    : [];
  return {
    preferredLengths,
    maintenanceTolerance: enumValue(input.maintenanceTolerance, MAINTENANCE, "open"),
    fringePreference: enumValue(input.fringePreference, FRINGE, "open"),
    colorChange: enumValue(input.colorChange, COLOR_CHANGE, "open"),
    moodIds,
    mustAvoid,
    summaryZh: cleanText(input.summaryZh, "我已经记下你的偏好，确认后会据此调整建议。"),
  };
}

export function normalizeConsultationTurn(value: unknown, forceReady = false): ConsultationTurnResult {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const requestedState = input.state === "ready_to_confirm" ? "ready_to_confirm" : "clarifying";
  return {
    state: forceReady ? "ready_to_confirm" : requestedState,
    reply: cleanText(input.reply, forceReady ? "我把你的想法整理好了，确认后就按这个方向调整。" : "你更在意长度、打理难度，还是刘海和发色？"),
    preferences: normalizePreferenceProfile(input.preferences),
  };
}

export function normalizeRecommendationRevision(value: unknown, current: HairAnalysis): RecommendationRevision {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  if (!Array.isArray(input.hairstyleSlots) || input.hairstyleSlots.length !== 4 || !Array.isArray(input.colors) || input.colors.length !== 2) {
    throw new Error("analysis_schema_invalid");
  }
  const validStyleIds = new Set(HAIRSTYLE_CATALOG.map((item) => item.id));
  const validColorIds = new Set(HAIR_COLOR_CATALOG.map((item) => item.id));
  const hairstyleSlots = input.hairstyleSlots.map((raw) => {
    const item = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    if (typeof item.slot !== "string" || !SLOTS.includes(item.slot)) throw new Error("analysis_slots_invalid");
    if (typeof item.styleId !== "string" || !validStyleIds.has(item.styleId)) throw new Error("analysis_style_invalid");
    if (typeof item.fringeId !== "string" || !FRINGES.has(item.fringeId)) throw new Error("analysis_schema_invalid");
    if (typeof item.partId !== "string" || !PARTS.has(item.partId)) throw new Error("analysis_schema_invalid");
    const rationaleIds = Array.isArray(item.rationaleIds) ? item.rationaleIds.filter((id): id is string => typeof id === "string" && RATIONALES.has(id)).slice(0, 3) : [];
    const promptTraits = Array.isArray(item.promptTraits) ? item.promptTraits.map((trait) => cleanText(trait)).filter(Boolean).slice(0, 4) : [];
    return { slot: item.slot as HairstyleRecommendation["slot"], styleId: item.styleId, fringeId: item.fringeId, partId: item.partId, rationaleIds, promptTraits };
  });
  if (!SLOTS.every((slot) => hairstyleSlots.filter((item) => item.slot === slot).length === 1)) throw new Error("analysis_slots_invalid");
  if (new Set(hairstyleSlots.map((item) => item.styleId)).size !== hairstyleSlots.length) throw new Error("analysis_style_invalid");

  const colors = input.colors.map((raw) => {
    const item = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    if (typeof item.colorId !== "string" || !validColorIds.has(item.colorId)) throw new Error("analysis_color_invalid");
    const level = typeof item.level === "number" && Number.isInteger(item.level) && item.level >= 1 && item.level <= 10 ? item.level : undefined;
    const promptTraits = Array.isArray(item.promptTraits) ? item.promptTraits.map((trait) => cleanText(trait)).filter(Boolean).slice(0, 4) : [];
    return { colorId: item.colorId, swatchHex: getColor(item.colorId).hex, level, promptTraits };
  });
  if (new Set(colors.map((item) => item.colorId)).size !== colors.length) throw new Error("analysis_color_invalid");

  const styleTraitIds = Array.isArray(input.styleTraitIds)
    ? input.styleTraitIds.filter((id): id is string => typeof id === "string" && STYLE_TRAITS.has(id)).slice(0, 3)
    : current.styleTraitIds;
  const change = input.changeSummary && typeof input.changeSummary === "object" ? input.changeSummary as Record<string, unknown> : {};
  return {
    styleTraitIds: styleTraitIds.length ? styleTraitIds : current.styleTraitIds,
    hairstyleSlots,
    colors,
    preferences: normalizePreferenceProfile(input.preferences),
    changeSummary: {
      zh: cleanText(change.zh, "已经按照你确认的偏好重新调整发型与发色建议。"),
      en: cleanText(change.en, "Recommendations updated around your confirmed preferences."),
    },
  };
}

export function mergeRevision(current: HairAnalysis, revision: RecommendationRevision): HairAnalysis {
  return {
    ...current,
    styleTraitIds: revision.styleTraitIds,
    hairstyleSlots: revision.hairstyleSlots,
    colors: revision.colors,
  };
}
