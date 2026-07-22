import { authorizeJob, toJobView } from "@/lib/server/jobs";
import { processJob } from "@/lib/server/processor";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ jobId: string }> };

export async function POST(request: Request, context: Context) {
  const { jobId } = await context.params;
  const job = await authorizeJob(request, jobId);
  if (!job) return Response.json({ error: "job_not_found" }, { status: 404 });
  if (["analyzing", "generating"].includes(job.status)) return Response.json(toJobView(job), { status: 202 });
  if (["expired", "deleted"].includes(job.status)) return Response.json({ error: job.status }, { status: 410 });
  try {
    const processed = await processJob(job);
    return Response.json(processed ? toJobView(processed) : { error: "job_not_found" });
  } catch {
    return Response.json({ error: "processing_failed" }, { status: 500 });
  }
}
