import { authorizeJob, saveFeedback } from "@/lib/server/jobs";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ jobId: string }> };

export async function POST(request: Request, context: Context) {
  const { jobId } = await context.params;
  const job = await authorizeJob(request, jobId);
  if (!job) return Response.json({ error: "job_not_found" }, { status: 404 });
  const payload = await request.json().catch(() => ({})) as { helpful?: unknown; selectedStyleId?: unknown };
  if (typeof payload.helpful !== "boolean") return Response.json({ error: "helpful_required" }, { status: 400 });
  await saveFeedback(jobId, payload.helpful, typeof payload.selectedStyleId === "string" ? payload.selectedStyleId : undefined);
  return Response.json({ saved: true });
}
