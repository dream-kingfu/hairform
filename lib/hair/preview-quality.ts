export const PREVIEW_QUALITY_METRICS = [
  "identity_preserved",
  "hair_target_matched",
  "non_hair_preserved",
  "artifact_free",
  "hair_edge_quality",
  "user_satisfaction",
] as const;

export type PreviewQualityMetric = typeof PREVIEW_QUALITY_METRICS[number];

export interface PreviewQualityObservation {
  metric: PreviewQualityMetric;
  score: number;
}

export interface PreviewQualityScore {
  overall: number;
  passed: boolean;
  missing: PreviewQualityMetric[];
  scores: Record<PreviewQualityMetric, number>;
}

export function scorePreviewQuality(observations: PreviewQualityObservation[], threshold = 0.8): PreviewQualityScore {
  const scores = Object.fromEntries(PREVIEW_QUALITY_METRICS.map((metric) => [metric, 0])) as Record<PreviewQualityMetric, number>;
  const seen = new Set<PreviewQualityMetric>();
  for (const observation of observations) {
    scores[observation.metric] = Math.max(0, Math.min(1, observation.score));
    seen.add(observation.metric);
  }
  const missing = PREVIEW_QUALITY_METRICS.filter((metric) => !seen.has(metric));
  const required = PREVIEW_QUALITY_METRICS.filter((metric) => metric !== "user_satisfaction");
  const overall = required.reduce((sum, metric) => sum + scores[metric], 0) / required.length;
  const criticalPassed = scores.identity_preserved >= threshold && scores.non_hair_preserved >= threshold && scores.artifact_free >= threshold;
  return { overall, passed: missing.filter((metric) => metric !== "user_satisfaction").length === 0 && criticalPassed && overall >= threshold, missing, scores };
}
