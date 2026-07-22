import type { AssetId } from "@/lib/hair/types";
import { authorizeJob, toJobView } from "@/lib/server/jobs";
import { processJob } from "@/lib/server/processor";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ jobId: string }> };
const IDS = new Set<AssetId>(["best_short", "best_medium", "best_long", "less_suitable", "color_primary", "color_secondary"]);

export async function POST(request: Request, context: Context) {
  const { jobId } = await context.params;
  const job = await authorizeJob(request, jobId);
  if (!job) return Response.json({ error: "job_not_found" }, { status: 404 });
  const payload = await request.json().catch(() => ({})) as { assetIds?: string[] };
  const assetIds = (payload.assetIds ?? []).filter((id): id is AssetId => IDS.has(id as AssetId));
  if (!assetIds.length) return Response.json({ error: "asset_ids_required" }, { status: 400 });
  try {
    const processed = await processJob(job, assetIds);
    return Response.json(processed ? toJobView(processed) : { error: "job_not_found" });
  } catch {
    return Response.json({ error: "retry_failed" }, { status: 500 });
  }
}
