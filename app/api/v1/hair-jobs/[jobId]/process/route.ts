import { authorizeJob, claimInitialJob, failJobWork, getJob, toJobView } from "@/lib/server/jobs";
import { safeErrorCode } from "@/lib/server/openai";
import { processJob } from "@/lib/server/processor";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ jobId: string }> };

export async function POST(request: Request, context: Context) {
  const { jobId } = await context.params;
  const job = await authorizeJob(request, jobId);
  if (!job) return Response.json({ error: "job_not_found" }, { status: 404 });
  if (["expired", "deleted"].includes(job.status)) return Response.json({ error: job.status }, { status: 410 });
  if (job.status !== "validating") {
    const active = ["analyzing", "generating", "compositing"].includes(job.status);
    return Response.json(toJobView(job), { status: active ? 202 : 200 });
  }
  const claimed = await claimInitialJob(jobId);
  if (!claimed) {
    const current = await getJob(jobId);
    return current ? Response.json(toJobView(current), { status: 202 }) : Response.json({ error: "job_not_found" }, { status: 404 });
  }
  try {
    const processed = await processJob(claimed);
    return Response.json(processed ? toJobView(processed) : { error: "job_not_found" });
  } catch (error) {
    const errorCode = safeErrorCode(error);
    await failJobWork(jobId, errorCode);
    return Response.json({ error: errorCode }, { status: 500 });
  }
}
