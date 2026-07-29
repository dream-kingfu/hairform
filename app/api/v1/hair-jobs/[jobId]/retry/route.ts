import type { AssetId } from "@/lib/hair/types";
import { authorizeJob, claimRetryJob, failJobWork, getRuntimeAiConfig, toJobView } from "@/lib/server/jobs";
import { processLegacyJob } from "@/lib/server/processor";
import { consumeRetryLimit, rateLimitResponse } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ jobId: string }> };
const IDS = new Set<AssetId>(["best_short", "best_medium", "best_long", "less_suitable", "color_primary", "color_secondary"]);

export async function POST(request: Request, context: Context) {
  const { jobId } = await context.params;
  const job = await authorizeJob(request, jobId);
  if (!job) return Response.json({ error: "job_not_found" }, { status: 404 });
  if (["single-preview-v1", "text-first-v1"].includes(job.generation_policy ?? "")) return Response.json({ error: "image_call_limit_reached" }, { status: 409 });
  if (!(await getRuntimeAiConfig()).imagePreviewEnabled) return Response.json({ error: "image_preview_disabled" }, { status: 403 });
  const payload = await request.json().catch(() => ({})) as { assetIds?: string[] };
  const assetIds = (payload.assetIds ?? []).filter((id): id is AssetId => IDS.has(id as AssetId));
  if (!assetIds.length) return Response.json({ error: "asset_ids_required" }, { status: 400 });
  if (!["completed", "partial", "failed"].includes(job.status)) return Response.json({ error: "job_busy" }, { status: 409 });
  const rateLimit = await consumeRetryLimit(request, assetIds.length);
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit);
  const claimed = await claimRetryJob(jobId);
  if (!claimed) return Response.json({ error: "job_busy" }, { status: 409 });
  try {
    const processed = await processLegacyJob(claimed, assetIds);
    return Response.json(processed ? await toJobView(processed) : { error: "job_not_found" });
  } catch {
    await failJobWork(jobId, "retry_failed");
    return Response.json({ error: "retry_failed" }, { status: 500 });
  }
}
