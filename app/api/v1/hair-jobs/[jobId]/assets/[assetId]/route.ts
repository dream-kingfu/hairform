import type { AssetId } from "@/lib/hair/types";
import { authorizeJob, assetKey, bindings } from "@/lib/server/jobs";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ jobId: string; assetId: string }> };
const PREVIEW_IDS = new Set<AssetId>(["best_short", "best_medium", "best_long", "less_suitable", "color_primary", "color_secondary"]);

export async function GET(request: Request, context: Context) {
  const { jobId, assetId } = await context.params;
  const job = await authorizeJob(request, jobId);
  if (!job || ["deleted", "expired"].includes(job.status)) return Response.json({ error: "asset_not_found" }, { status: 404 });
  let key: string | null = null;
  if (assetId === "original") key = job.original_key;
  else if (assetId === "report") key = job.report_key;
  else if (assetId === "report_preview") key = job.preview_key;
  else if (PREVIEW_IDS.has(assetId as AssetId)) key = assetKey(jobId, assetId as AssetId);
  if (!key) return Response.json({ error: "asset_not_found" }, { status: 404 });
  const object = await bindings.HAIR_ASSETS.get(key);
  if (!object) return Response.json({ error: "asset_not_found" }, { status: 404 });
  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType || "application/octet-stream",
      "Content-Length": String(object.size),
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
