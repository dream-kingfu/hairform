import type { BarberBrief } from "./barber-brief";

export type FaceShape =
  | "oval"
  | "round"
  | "square"
  | "heart"
  | "oblong"
  | "diamond"
  | "mixed"
  | "unknown";

export type HairTexture = "straight" | "wavy" | "curly" | "coily" | "unknown";
export type HairDensity = "low" | "medium" | "high" | "unknown";
export type Hairline = "low" | "balanced" | "high" | "receding" | "widows_peak" | "unknown";
export type ForeheadRatio = "short" | "balanced" | "long" | "unknown";
export type SkinUndertone = "warm" | "cool" | "neutral" | "unknown";
export type HairSlot = "best_short" | "best_medium" | "best_long" | "less_suitable";
export type AssetId = HairSlot | "color_primary" | "color_secondary";
export type AnalysisProvider = "kie" | "qwen" | "glm";
export type JobStatus =
  | "validating"
  | "analyzing"
  | "analysis_ready"
  | "awaiting_selection"
  | "generating"
  | "compositing"
  | "completed"
  | "partial"
  | "failed"
  | "expired"
  | "deleted";

export interface HairstyleRecommendation {
  slot: HairSlot;
  styleId: string;
  fringeId: string;
  partId: string;
  rationaleIds: string[];
  promptTraits: string[];
}

export interface HairColorRecommendation {
  colorId: string;
  swatchHex: string;
  level?: number;
  promptTraits: string[];
}

export interface HairAnalysis {
  faceShape: FaceShape;
  hairTexture: HairTexture;
  hairDensity: HairDensity;
  hairline: Hairline;
  foreheadRatio: ForeheadRatio;
  skinUndertone: SkinUndertone;
  styleTraitIds: string[];
  hairstyleSlots: HairstyleRecommendation[];
  colors: HairColorRecommendation[];
  warnings: string[];
}

export interface JobAsset {
  id: AssetId;
  kind: "hairstyle" | "color";
  status: "not_requested" | "pending" | "generating" | "ready" | "failed";
  url?: string;
  errorCode?: string;
}

export interface HairJobView {
  id: string;
  status: JobStatus;
  progress: number;
  analysis?: HairAnalysis;
  assets: JobAsset[];
  originalUrl?: string;
  reportUrl?: string;
  previewUrl?: string;
  expiresAt: string;
  demoMode: boolean;
  errorCode?: string;
  presentation?: HairJobPresentation;
  generationPolicy?: {
    version: "text-first-v1" | "single-preview-v1" | "legacy-six-v1";
    selectableAssetIds: Array<"best_short" | "best_medium" | "best_long">;
    selectedAssetId?: "best_short" | "best_medium" | "best_long";
    imageCallsUsed: number;
    imageCallsLimit: number;
    imagePreviewAvailable: boolean;
  };
  analysisProvider?: AnalysisProvider;
  analysisModel?: string;
}

export interface BilingualLabel {
  zh: string;
  en: string;
}

export interface HairJobPresentation {
  traits: Array<{
    id: string;
    kind: "faceShape" | "hairTexture" | "hairDensity" | "hairline" | "foreheadRatio" | "skinUndertone" | "styleTrait";
    label: BilingualLabel;
  }>;
  hairstyles: Array<{
    assetId: HairSlot;
    slotLabel: BilingualLabel;
    styleId: string;
    styleLabel: BilingualLabel;
    lengthLabel: BilingualLabel;
    fringeLabel: BilingualLabel;
    partLabel: BilingualLabel;
    barberBrief?: BarberBrief;
  }>;
  colors: Array<{
    assetId: "color_primary" | "color_secondary";
    colorId: string;
    label: BilingualLabel;
    swatchHex: string;
    levelLabel: BilingualLabel;
  }>;
  overallStyle: BilingualLabel;
}
