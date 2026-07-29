import { authorizeJob, getJob, parseAssets, putAsset, toJobView, updateJob } from "@/lib/server/jobs";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ jobId: string }> };

const REPORT_MAX_SIZE = 30 * 1024 * 1024;
const PREVIEW_MAX_SIZE = 15 * 1024 * 1024;

export async function POST(request: Request, context: Context) {
  const { jobId } = await context.params;
  const job = await authorizeJob(request, jobId);
  if (!job) return Response.json({ error: "job_not_found" }, { status: 404 });
  if (!["analysis_ready", "compositing", "completed", "partial"].includes(job.status)) return Response.json({ error: "job_not_ready" }, { status: 409 });

  const form = await request.formData();
  const kind = form.get("kind");
  const file = form.get("file");
  if (kind !== "report" && kind !== "preview") return Response.json({ error: "invalid_report_kind" }, { status: 400 });
  if (!(file instanceof File)) return Response.json({ error: "report_file_required" }, { status: 400 });

  const validType = kind === "report" ? file.type === "image/png" : ["image/png", "image/webp"].includes(file.type);
  const maxSize = kind === "report" ? REPORT_MAX_SIZE : PREVIEW_MAX_SIZE;
  if (!validType || file.size <= 0 || file.size > maxSize) return Response.json({ error: "invalid_report_file" }, { status: 400 });

  const extension = file.type === "image/webp" ? "webp" : "png";
  const key = `jobs/${jobId}/${kind === "report" ? "report" : "report_preview"}.${extension}`;
  await putAsset(key, await file.arrayBuffer(), file.type);
  await updateJob(jobId, kind === "report" ? { reportKey: key } : { previewKey: key });

  let current = await getJob(jobId);
  if (!current) return Response.json({ error: "job_not_found" }, { status: 404 });
  if (current.report_key && current.preview_key) {
    const hasFailures = parseAssets(current).some((asset) => asset.status === "failed");
    const hasRequestedPreview = Boolean(current.selected_asset_id);
    await updateJob(jobId, { status: hasRequestedPreview ? (hasFailures ? "partial" : "completed") : "analysis_ready", progress: 100 });
    current = await getJob(jobId);
  }

  return Response.json(current ? await toJobView(current) : { error: "job_not_found" });
}
