import { authorizeJob, cancelConsultation, claimConsultationJob, getJob, toJobView } from "@/lib/server/jobs";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ jobId: string }> };

export async function POST(request: Request, context: Context) {
  const { jobId } = await context.params;
  const job = await authorizeJob(request, jobId);
  if (!job) return Response.json({ error: "job_not_found" }, { status: 404 });
  if (job.selected_asset_id) return Response.json({ error: "consultation_locked" }, { status: 409 });
  const claimed = await claimConsultationJob(jobId, ["clarifying", "ready_to_confirm"]);
  if (!claimed) return Response.json({ error: "job_busy" }, { status: 409 });
  await cancelConsultation(jobId);
  const current = await getJob(jobId);
  return Response.json(current ? await toJobView(current) : { error: "job_not_found" });
}
