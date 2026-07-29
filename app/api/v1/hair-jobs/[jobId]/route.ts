import { authorizeJob, claimGenerationPoll, deleteJob, failJobWork, getJob, toJobView } from "@/lib/server/jobs";
import { safeErrorCode } from "@/lib/server/openai";
import { advanceSelectedGeneration } from "@/lib/server/processor";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ jobId: string }> };

export async function GET(request: Request, context: Context) {
  const { jobId } = await context.params;
  const authorized = await authorizeJob(request, jobId);
  if (!authorized) return Response.json({ error: "job_not_found" }, { status: 404 });
  let current = await getJob(jobId);
  if (current?.status === "generating" && current.provider_task_id) {
    const claimed = await claimGenerationPoll(jobId);
    if (claimed) {
      try {
        current = await advanceSelectedGeneration(claimed);
      } catch (error) {
        await failJobWork(jobId, safeErrorCode(error));
        current = await getJob(jobId);
      }
    }
  }
  return Response.json(await toJobView(current ?? authorized), { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request, context: Context) {
  const { jobId } = await context.params;
  const job = await authorizeJob(request, jobId);
  if (!job) return Response.json({ error: "job_not_found" }, { status: 404 });
  await deleteJob(job);
  return Response.json({ status: "deleted" });
}
