export const MODEL_POLICY = {
  version: "text-first-v1" as const,
  analysis: { model: "gpt-5-6-terra", reasoning: "medium", perJobLimit: 1 },
  quality: { model: "gpt-5-6-luna", reasoning: "low", perJobLimit: 2 },
  qualityEscalation: { model: "gpt-5-6-terra", reasoning: "low", perJobLimit: 1 },
  imageEdit: { model: "gpt-image-2-image-to-image", perJobLimit: 2 },
} as const;

export type ModelPurpose = "analysis" | "quality" | "quality_escalation" | "image_edit";

export interface ModelPolicyBindings {
  AI_PROVIDER?: string;
  KIE_ANALYSIS_MODEL?: string;
  KIE_QC_MODEL?: string;
  KIE_IMAGE_MODEL?: string;
}

export const ANALYSIS_MODEL_ALLOWLIST = {
  kie: "gpt-5-6-terra",
  qwen: "qwen3.6-flash",
  glm: "glm-4.6v-flash",
} as const;

export const CONSULTATION_MODEL_ALLOWLIST = {
  kie: "gpt-5-6-terra",
  qwen: "qwen3.6-flash",
} as const;

export function modelFor(purpose: ModelPurpose) {
  if (purpose === "analysis") return MODEL_POLICY.analysis.model;
  if (purpose === "quality") return MODEL_POLICY.quality.model;
  if (purpose === "quality_escalation") return MODEL_POLICY.qualityEscalation.model;
  return MODEL_POLICY.imageEdit.model;
}

export function reasoningFor(purpose: Exclude<ModelPurpose, "image_edit">) {
  return purpose === "analysis"
    ? MODEL_POLICY.analysis.reasoning
    : purpose === "quality"
      ? MODEL_POLICY.quality.reasoning
      : MODEL_POLICY.qualityEscalation.reasoning;
}

export function assertProductionModelPolicy(bindings: ModelPolicyBindings) {
  const provider = bindings.AI_PROVIDER?.trim().toLowerCase() || "kie";
  const valid = provider === "kie"
    && (!bindings.KIE_ANALYSIS_MODEL || bindings.KIE_ANALYSIS_MODEL === MODEL_POLICY.analysis.model)
    && (!bindings.KIE_QC_MODEL || bindings.KIE_QC_MODEL === MODEL_POLICY.quality.model)
    && (!bindings.KIE_IMAGE_MODEL || bindings.KIE_IMAGE_MODEL === MODEL_POLICY.imageEdit.model);
  if (!valid) throw new Error("model_policy_error");
}

export function assertAnalysisModelPolicy(provider: string, model: string) {
  if (!(provider in ANALYSIS_MODEL_ALLOWLIST)
    || ANALYSIS_MODEL_ALLOWLIST[provider as keyof typeof ANALYSIS_MODEL_ALLOWLIST] !== model) {
    throw new Error("model_policy_error");
  }
}

export function assertConsultationModelPolicy(provider: string, model: string) {
  if (!(provider in CONSULTATION_MODEL_ALLOWLIST)
    || CONSULTATION_MODEL_ALLOWLIST[provider as keyof typeof CONSULTATION_MODEL_ALLOWLIST] !== model) {
    throw new Error("model_policy_error");
  }
}
