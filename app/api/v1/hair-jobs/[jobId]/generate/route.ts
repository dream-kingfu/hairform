import { authorizeJob, claimGenerationJob, failJobWork, getJob, toJobView } from "@/lib/server/jobs";
import { safeErrorCode } from "@/lib/server/openai";
import { generateSelected } from "@/lib/server/processor";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ jobId: string }> };
const SELECTABLE = new Set(["best_short", "best_medium", "best_long"] as const);

export async function POST(request: Request, context: Context) {
  const { jobId } = await context.params;
  const job = await authorizeJob(request, jobId);
  if (!job) return Response.json({ error: "job_not_found" }, { status: 404 });
  if (job.generation_policy !== "single-preview-v1") return Response.json({ error: "generation_policy_mismatch" }, { status: 409 });
  const payload = await request.json().catch(() => ({})) as { assetId?: string; model?: unknown };
  if (payload.model !== undefined) return Response.json({ error: "model_not_allowed" }, { status: 400 });
  if (!payload.assetId || !SELECTABLE.has(payload.assetId as "best_short" | "best_medium" | "best_long")) {
    return Response.json({ error: "asset_not_selectable" }, { status: 400 });
  }
  const assetId = payload.assetId as "best_short" | "best_medium" | "best_long";
  if (job.selected_asset_id && job.selected_asset_id !== assetId) return Response.json({ error: "selection_locked" }, { status: 409 });
  if (job.selected_asset_id === assetId) {
    const current = await getJob(jobId);
    return Response.json(toJobView((current ?? job) as Parameters<typeof toJobView>[0]), { status: ["generating", "compositing"].includes(current?.status ?? job.status) ? 202 : 200 });
  }
  if (job.status !== "awaiting_selection") return Response.json({ error: "job_not_ready" }, { status: 409 });
  const claimed = await claimGenerationJob(jobId, assetId);
  if (!claimed) {
    const current = await getJob(jobId);
    if (!current) return Response.json({ error: "job_not_found" }, { status: 404 });
    if (current.selected_asset_id && current.selected_asset_id !== assetId) return Response.json({ error: "selection_locked" }, { status: 409 });
    return Response.json(toJobView(current), { status: 202 });
  }
  try {
    const processed = await generateSelected(claimed, assetId);
    return Response.json(processed ? toJobView(processed) : { error: "job_not_found" });
  } catch (error) {
    const code = safeErrorCode(error);
    await failJobWork(jobId, code);
    const current = await getJob(jobId);
    return Response.json(current ? toJobView(current) : { error: code }, { status: current ? 200 : 500 });
  }
}
