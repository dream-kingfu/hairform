import type { AssetId, HairAnalysis, JobAsset } from "@/lib/hair/types";
import { MODEL_POLICY } from "./model-policy";
import { analyzePortrait, editPortrait, generationBatchSize, qualityCheck, safeErrorCode, type QualityCheckResult } from "./openai";
import { consumeModelCallLimit } from "./rate-limit";
import { assetKey, bindings, getJob, isDemoMode, parseAssets, putAsset, reserveJobCall, updateJob, type StoredJob } from "./jobs";

async function sourceBytes(job: StoredJob) {
  const original = await bindings.HAIR_ASSETS.get(job.original_key);
  if (!original) throw new Error("original_missing");
  const image = await original.arrayBuffer();
  const contentType = original.httpMetadata?.contentType || "image/png";
  const maskObject = job.mask_key ? await bindings.HAIR_ASSETS.get(job.mask_key) : null;
  const mask = maskObject ? await maskObject.arrayBuffer() : undefined;
  return { image, contentType, mask };
}

function passed(qc: QualityCheckResult) {
  return qc.identityPreserved && qc.hairTargetMatched && qc.nonHairRegionPreserved && qc.artifactFree;
}

async function reserveCall(jobId: string, kind: "analysis" | "image" | "quality" | "quality_escalation", limit: number, errorCode: string) {
  if (!isDemoMode()) {
    const global = await consumeModelCallLimit(kind);
    if (!global.allowed) throw new Error("model_daily_limit");
  }
  const count = await reserveJobCall(jobId, kind, limit);
  if (!count) throw new Error(errorCode);
  return count;
}

async function runQualityCheck(input: Parameters<typeof qualityCheck>[0], jobId: string) {
  await reserveCall(jobId, "quality", MODEL_POLICY.quality.perJobLimit, "quality_call_limit");
  let primary: QualityCheckResult | undefined;
  try {
    primary = await qualityCheck(input, "quality");
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message !== "analysis_output_missing" && !(error instanceof SyntaxError)) throw new Error("quality_service_failed");
  }
  if (primary && primary.confidence >= 0.8) return passed(primary);
  await reserveCall(jobId, "quality_escalation", MODEL_POLICY.qualityEscalation.perJobLimit, "quality_call_limit");
  const escalation = await qualityCheck(input, "quality_escalation");
  return escalation.confidence >= 0.72 && passed(escalation);
}

export async function analyzeJob(job: StoredJob) {
  if (job.analysis_json) {
    await updateJob(job.id, { status: "awaiting_selection", progress: 35, errorCode: null, workLockUntil: null });
    return getJob(job.id);
  }
  const { image, contentType } = await sourceBytes(job);
  await updateJob(job.id, { status: "analyzing", progress: 12, errorCode: null });
  await reserveCall(job.id, "analysis", MODEL_POLICY.analysis.perJobLimit, "analysis_call_limit");
  const analysis = await analyzePortrait(image, contentType);
  const qualityBlockers = new Set(["side_angle", "hat", "hairline_occluded", "multiple_faces", "no_face", "too_dark", "face_too_small"]);
  if (analysis.warnings.some((warning) => qualityBlockers.has(warning))) {
    await updateJob(job.id, { status: "failed", progress: 100, analysis, errorCode: "photo_quality_failed", workLockUntil: null });
    return getJob(job.id);
  }
  await updateJob(job.id, { status: "awaiting_selection", progress: 35, analysis, errorCode: null, workLockUntil: null });
  return getJob(job.id);
}

export async function generateSelected(job: StoredJob, id: "best_short" | "best_medium" | "best_long") {
  if (!job.analysis_json) throw new Error("analysis_required");
  const analysis = JSON.parse(job.analysis_json) as HairAnalysis;
  const { image, contentType, mask } = await sourceBytes(job);
  let assets = parseAssets(job).map((asset) => asset.id === id ? { ...asset, status: "generating" as const, errorCode: undefined } : asset);
  await updateJob(job.id, { status: "generating", progress: 46, assets, reportKey: null, previewKey: null, errorCode: null });

  let lastError: unknown = new Error("generation_failed");
  for (let attempt = job.image_calls ?? 0; attempt < MODEL_POLICY.imageEdit.perJobLimit; attempt += 1) {
    try {
      const used = await reserveCall(job.id, "image", MODEL_POLICY.imageEdit.perJobLimit, "image_call_limit_reached");
      const output = await editPortrait({ id, image, contentType, analysis, mask: used > 1 ? mask : undefined });
      const ok = await runQualityCheck({
        id,
        original: image,
        output: output.bytes,
        outputType: output.contentType,
        originalType: contentType,
        analysis,
      }, job.id);
      if (!ok) throw new Error("quality_check_failed");
      await putAsset(assetKey(job.id, id), output.bytes, output.contentType);
      assets = assets.map((asset) => asset.id === id ? { ...asset, status: "ready" as const, errorCode: undefined } : asset);
      await updateJob(job.id, { status: "compositing", progress: 92, assets, errorCode: null, workLockUntil: null });
      return getJob(job.id);
    } catch (error) {
      lastError = error;
      if (error instanceof Error && error.message === "quality_service_failed") break;
      const current = await getJob(job.id);
      if ((current?.image_calls ?? MODEL_POLICY.imageEdit.perJobLimit) >= MODEL_POLICY.imageEdit.perJobLimit) break;
    }
  }
  assets = assets.map((asset) => asset.id === id ? { ...asset, status: "failed" as const, errorCode: safeErrorCode(lastError) } : asset);
  await updateJob(job.id, { status: "failed", progress: 100, assets, errorCode: safeErrorCode(lastError), workLockUntil: null });
  return getJob(job.id);
}

async function generateLegacyOne(input: {
  job: StoredJob;
  asset: JobAsset;
  analysis: HairAnalysis;
  image: ArrayBuffer;
  contentType: string;
  mask?: ArrayBuffer;
}) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const output = await editPortrait({
        id: input.asset.id,
        image: input.image,
        contentType: input.contentType,
        analysis: input.analysis,
        mask: attempt === 1 ? input.mask : undefined,
      });
      const qc = await qualityCheck({
        id: input.asset.id,
        original: input.image,
        output: output.bytes,
        outputType: output.contentType,
        originalType: input.contentType,
        analysis: input.analysis,
      });
      if (!passed(qc) || qc.confidence < 0.72) throw new Error("quality_check_failed");
      await putAsset(assetKey(input.job.id, input.asset.id), output.bytes, output.contentType);
      return { ...input.asset, status: "ready" as const, errorCode: undefined };
    } catch (error) { lastError = error; }
  }
  return { ...input.asset, status: "failed" as const, errorCode: safeErrorCode(lastError) };
}

export async function processLegacyJob(job: StoredJob, onlyIds?: AssetId[]) {
  const { image, contentType, mask } = await sourceBytes(job);
  let analysis = job.analysis_json ? JSON.parse(job.analysis_json) as HairAnalysis : undefined;
  if (!analysis) {
    await updateJob(job.id, { status: "analyzing", progress: 12, errorCode: null });
    analysis = await analyzePortrait(image, contentType);
    await updateJob(job.id, { status: "generating", progress: 22, analysis });
  }
  let assets = parseAssets((await getJob(job.id)) ?? job);
  const targetIds = new Set<AssetId>(onlyIds?.length ? onlyIds : assets.map((asset) => asset.id));
  assets = assets.map((asset) => targetIds.has(asset.id) ? { ...asset, status: "pending", errorCode: undefined } : asset);
  await updateJob(job.id, { status: "generating", progress: 24, assets, reportKey: null, previewKey: null });
  const pending = assets.filter((asset) => targetIds.has(asset.id));
  const batchSize = generationBatchSize();
  for (let start = 0; start < pending.length; start += batchSize) {
    const batch = pending.slice(start, start + batchSize);
    assets = assets.map((asset) => batch.some((item) => item.id === asset.id) ? { ...asset, status: "generating" } : asset);
    await updateJob(job.id, { assets, progress: 25 + Math.round((start / Math.max(pending.length, 1)) * 62) });
    const results = await Promise.all(batch.map((asset) => generateLegacyOne({ job, asset, analysis: analysis!, image, contentType, mask })));
    const resultMap = new Map(results.map((result) => [result.id, result]));
    assets = assets.map((asset) => resultMap.get(asset.id) ?? asset);
  }
  const readyHair = assets.filter((asset) => asset.kind === "hairstyle" && asset.status === "ready").length;
  const readyColor = assets.filter((asset) => asset.kind === "color" && asset.status === "ready").length;
  const canCompose = readyHair >= 3 && readyColor >= 1;
  await updateJob(job.id, { status: canCompose ? "compositing" : "failed", progress: canCompose ? 92 : 100, assets, errorCode: canCompose ? null : "insufficient_previews", workLockUntil: null });
  return getJob(job.id);
}
