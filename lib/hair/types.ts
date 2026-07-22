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
export type JobStatus =
  | "validating"
  | "analyzing"
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
  status: "pending" | "generating" | "ready" | "failed";
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
}

export interface BilingualLabel {
  zh: string;
  en: string;
}
