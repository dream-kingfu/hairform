import type { AssetId, HairAnalysis, JobAsset } from "@/lib/hair/types";
import { analyzePortrait, editPortrait, qualityCheck, safeErrorCode } from "./openai";
import { assetKey, bindings, getJob, parseAssets, putAsset, updateJob, type StoredJob } from "./jobs";

async function sourceBytes(job: StoredJob) {
  const original = await bindings.HAIR_ASSETS.get(job.original_key);
  if (!original) throw new Error("original_missing");
  const image = await original.arrayBuffer();
  const contentType = original.httpMetadata?.contentType || "image/png";
  const maskObject = job.mask_key ? await bindings.HAIR_ASSETS.get(job.mask_key) : null;
  const mask = maskObject ? await maskObject.arrayBuffer() : undefined;
  return { image, contentType, mask };
}

async function generateOne(input: {
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
      const passes = await qualityCheck({
        id: input.asset.id,
        original: input.image,
        output,
        originalType: input.contentType,
        analysis: input.analysis,
      });
      if (!passes) throw new Error("quality_check_failed");
      await putAsset(assetKey(input.job.id, input.asset.id), output, input.job.demo_mode ? input.contentType : "image/png");
      return { ...input.asset, status: "ready" as const, errorCode: undefined };
    } catch (error) {
      lastError = error;
    }
  }
  return { ...input.asset, status: "failed" as const, errorCode: safeErrorCode(lastError) };
}

export async function processJob(job: StoredJob, onlyIds?: AssetId[]) {
  const { image, contentType, mask } = await sourceBytes(job);
  let analysis = job.analysis_json ? JSON.parse(job.analysis_json) as HairAnalysis : undefined;
  if (!analysis) {
    await updateJob(job.id, { status: "analyzing", progress: 12, errorCode: null });
    analysis = await analyzePortrait(image, contentType);
    const qualityBlockers = new Set(["side_angle", "hat", "hairline_occluded", "multiple_faces", "no_face", "too_dark", "face_too_small"]);
    if (analysis.warnings.some((warning) => qualityBlockers.has(warning))) {
      await updateJob(job.id, { status: "failed", progress: 100, analysis, errorCode: "photo_quality_failed" });
      return getJob(job.id);
    }
    await updateJob(job.id, { status: "generating", progress: 22, analysis });
  }

  let assets = parseAssets((await getJob(job.id)) ?? job);
  const targetIds = new Set<AssetId>(onlyIds?.length ? onlyIds : assets.map((asset) => asset.id));
  assets = assets.map((asset) => targetIds.has(asset.id) ? { ...asset, status: "pending", errorCode: undefined } : asset);
  await updateJob(job.id, { status: "generating", progress: 24, assets, reportKey: null, previewKey: null });

  const pending = assets.filter((asset) => targetIds.has(asset.id));
  for (let start = 0; start < pending.length; start += 3) {
    const batch = pending.slice(start, start + 3);
    assets = assets.map((asset) => batch.some((item) => item.id === asset.id) ? { ...asset, status: "generating" } : asset);
    await updateJob(job.id, { assets, progress: 25 + Math.round((start / Math.max(pending.length, 1)) * 62) });
    const results = await Promise.all(batch.map((asset) => generateOne({ job, asset, analysis: analysis!, image, contentType, mask })));
    const resultMap = new Map(results.map((result) => [result.id, result]));
    assets = assets.map((asset) => resultMap.get(asset.id) ?? asset);
    await updateJob(job.id, { assets, progress: 25 + Math.round(((start + batch.length) / Math.max(pending.length, 1)) * 62) });
  }

  const readyHair = assets.filter((asset) => asset.kind === "hairstyle" && asset.status === "ready").length;
  const readyColor = assets.filter((asset) => asset.kind === "color" && asset.status === "ready").length;
  const canCompose = readyHair >= 3 && readyColor >= 1;
  await updateJob(job.id, {
    status: canCompose ? "compositing" : "failed",
    progress: canCompose ? 92 : 100,
    assets,
    errorCode: canCompose ? null : "insufficient_previews",
  });
  return getJob(job.id);
}
