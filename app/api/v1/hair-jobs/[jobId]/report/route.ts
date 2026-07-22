import { authorizeJob, assetKey, parseAssets, putAsset, updateJob } from "@/lib/server/jobs";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ jobId: string }> };
const MAX_REPORT_SIZE = 30 * 1024 * 1024;

export async function POST(request: Request, context: Context) {
  const { jobId } = await context.params;
  const job = await authorizeJob(request, jobId);
  if (!job) return Response.json({ error: "job_not_found" }, { status: 404 });
  if (!['compositing', 'partial', 'completed'].includes(job.status)) return Response.json({ error: "job_not_ready" }, { status: 409 });
  const form = await request.formData();
  const report = form.get("report");
  const preview = form.get("preview");
  if (!(report instanceof File) || report.type !== "image/png" || report.size > MAX_REPORT_SIZE) {
    return Response.json({ error: "invalid_report" }, { status: 400 });
  }
  if (!(preview instanceof File) || preview.type !== "image/webp" || preview.size > MAX_REPORT_SIZE) {
    return Response.json({ error: "invalid_preview" }, { status: 400 });
  }
  const reportKey = assetKey(jobId, "report");
  const previewKey = assetKey(jobId, "report_preview");
  await Promise.all([
    putAsset(reportKey, await report.arrayBuffer(), "image/png"),
    putAsset(previewKey, await preview.arrayBuffer(), "image/webp"),
  ]);
  const hasFailures = parseAssets(job).some((asset) => asset.status === "failed");
  await updateJob(jobId, { status: hasFailures ? "partial" : "completed", progress: 100, reportKey, previewKey });
  return Response.json({
    status: hasFailures ? "partial" : "completed",
    reportUrl: `/api/v1/hair-jobs/${jobId}/assets/report`,
    previewUrl: `/api/v1/hair-jobs/${jobId}/assets/report_preview`,
  });
}
