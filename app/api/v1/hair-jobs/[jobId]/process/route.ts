import { authorizeJob, claimInitialJob, failJobWork, getJob, toJobView } from "@/lib/server/jobs";
import { safeErrorCode } from "@/lib/server/openai";
import { analyzeJob, processLegacyJob } from "@/lib/server/processor";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ jobId: string }> };

export async function POST(request: Request, context: Context) {
  const { jobId } = await context.params;
  const job = await authorizeJob(request, jobId);
  if (!job) return Response.json({ error: "job_not_found" }, { status: 404 });
  if (["expired", "deleted"].includes(job.status)) return Response.json({ error: job.status }, { status: 410 });
  if (job.status !== "validating") {
    const active = ["analyzing", "generating", "compositing"].includes(job.status);
    return Response.json(await toJobView(job), { status: active ? 202 : 200 });
  }
  const claimed = await claimInitialJob(jobId);
  if (!claimed) {
    const current = await getJob(jobId);
    return current ? Response.json(await toJobView(current), { status: 202 }) : Response.json({ error: "job_not_found" }, { status: 404 });
  }
  try {
    const processed = ["single-preview-v1", "text-first-v1"].includes(claimed.generation_policy ?? "") ? await analyzeJob(claimed) : await processLegacyJob(claimed);
    return Response.json(processed ? await toJobView(processed) : { error: "job_not_found" });
  } catch (error) {
    const errorCode = safeErrorCode(error);
    console.error("Hair job processing failed", {
      errorCode,
      name: error instanceof Error ? error.name : "UnknownError",
    });
    await failJobWork(jobId, errorCode);
    return Response.json({ error: errorCode }, { status: 500 });
  }
}
