import { authorizeJob, deleteJob, getJob, toJobView } from "@/lib/server/jobs";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ jobId: string }> };

export async function GET(request: Request, context: Context) {
  const { jobId } = await context.params;
  const authorized = await authorizeJob(request, jobId);
  if (!authorized) return Response.json({ error: "job_not_found" }, { status: 404 });
  const current = await getJob(jobId);
  return Response.json(toJobView(current ?? authorized), { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request, context: Context) {
  const { jobId } = await context.params;
  const job = await authorizeJob(request, jobId);
  if (!job) return Response.json({ error: "job_not_found" }, { status: 404 });
  await deleteJob(job);
  return Response.json({ status: "deleted" });
}
