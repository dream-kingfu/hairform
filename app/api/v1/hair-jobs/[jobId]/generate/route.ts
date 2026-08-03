import { authorizeJob, claimGenerationJob, getJob, getRuntimeAiConfig, parseAssets, toJobView, updateJob } from "@/lib/server/jobs";
import { safeErrorCode } from "@/lib/server/openai";
import { generateSelected } from "@/lib/server/processor";
import { ensureCanGeneratePreview } from "@/lib/server/provider-health";
import type { PreviewAssetId } from "@/lib/hair/types";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ jobId: string }> };
const SELECTABLE = new Set<PreviewAssetId>(["best_short", "best_medium", "best_long", "color_primary", "color_secondary"]);

export async function POST(request: Request, context: Context) {
  const { jobId } = await context.params;
  const job = await authorizeJob(request, jobId);
  if (!job) return Response.json({ error: "job_not_found" }, { status: 404 });
  if (!["single-preview-v1", "text-first-v1"].includes(job.generation_policy ?? "")) return Response.json({ error: "generation_policy_mismatch" }, { status: 409 });
  const runtime = await getRuntimeAiConfig();
  if (!runtime.imagePreviewEnabled) return Response.json({ error: "image_preview_disabled" }, { status: 403 });
  if (["clarifying", "ready_to_confirm", "revising"].includes(job.consultation_state)) return Response.json({ error: "consultation_in_progress" }, { status: 409 });
  const payload = await request.json().catch(() => ({})) as { assetId?: string; model?: unknown };
  if (payload.model !== undefined) return Response.json({ error: "model_not_allowed" }, { status: 400 });
  if (!payload.assetId || !SELECTABLE.has(payload.assetId as PreviewAssetId)) {
    return Response.json({ error: "asset_not_selectable" }, { status: 400 });
  }
  const assetId = payload.assetId as PreviewAssetId;
  if (job.selected_asset_id && job.selected_asset_id !== assetId) return Response.json({ error: "selection_locked" }, { status: 409 });
  if (job.selected_asset_id === assetId) {
    const current = await getJob(jobId);
    return Response.json(await toJobView(current ?? job), { status: ["generating", "compositing"].includes(current?.status ?? job.status) ? 202 : 200 });
  }
  if (!["analysis_ready", "awaiting_selection", "completed", "partial"].includes(job.status)) return Response.json({ error: "job_not_ready" }, { status: 409 });
  try { await ensureCanGeneratePreview(); }
  catch (error) { return Response.json({ error: safeErrorCode(error) }, { status: 503 }); }
  const claimed = await claimGenerationJob(jobId, assetId);
  if (!claimed) {
    const current = await getJob(jobId);
    if (!current) return Response.json({ error: "job_not_found" }, { status: 404 });
    if (current.selected_asset_id && current.selected_asset_id !== assetId) return Response.json({ error: "selection_locked" }, { status: 409 });
    return Response.json(await toJobView(current), { status: 202 });
  }
  try {
    const processed = await generateSelected(claimed, assetId);
    return Response.json(processed ? await toJobView(processed) : { error: "job_not_found" });
  } catch (error) {
    const code = safeErrorCode(error);
    let current = await getJob(jobId);
    if (current) {
      const assets = parseAssets(current).map((asset) => asset.id === assetId ? { ...asset, status: "failed" as const, errorCode: code } : asset);
      await updateJob(jobId, { status: current.generation_policy === "text-first-v1" ? "analysis_ready" : "failed", progress: 100, assets, errorCode: code, workLockUntil: null, providerTaskId: null });
      current = await getJob(jobId);
    }
    return Response.json(current ? await toJobView(current) : { error: code }, { status: current ? 200 : 500 });
  }
}
