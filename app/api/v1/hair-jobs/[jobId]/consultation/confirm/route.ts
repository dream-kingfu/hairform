import { mergeRevision } from "@/lib/hair/consultation";
import type { HairAnalysis } from "@/lib/hair/types";
import { authorizeJob, beginConsultationRevision, claimConsultationJob, completeConsultationRevision, failConsultationWork, getJob, getRuntimeAiConfig, parsePreferences, toJobView } from "@/lib/server/jobs";
import { isAnalysisProviderConfigured, reviseHairRecommendations, safeErrorCode } from "@/lib/server/openai";
import { consumeConsultationCallLimit, rateLimitResponse } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ jobId: string }> };

export async function POST(request: Request, context: Context) {
  const { jobId } = await context.params;
  const job = await authorizeJob(request, jobId);
  if (!job) return Response.json({ error: "job_not_found" }, { status: 404 });
  const runtime = await getRuntimeAiConfig();
  if (!runtime.consultationEnabled) return Response.json({ error: "consultation_disabled" }, { status: 403 });
  if (!job.analysis_json || job.consultation_state !== "ready_to_confirm" || job.selected_asset_id) return Response.json({ error: "consultation_not_ready" }, { status: 409 });
  if (job.revision_calls >= 2) return Response.json({ error: "revision_limit_reached" }, { status: 409 });
  if (!isAnalysisProviderConfigured(job.consultation_provider)) return Response.json({ error: "provider_not_configured" }, { status: 503 });
  const preferences = parsePreferences(job.pending_preferences_json);
  if (!preferences) return Response.json({ error: "consultation_not_ready" }, { status: 409 });
  const claimed = await claimConsultationJob(jobId, ["ready_to_confirm"]);
  if (!claimed) return Response.json({ error: "job_busy" }, { status: 409 });
  const rateLimit = await consumeConsultationCallLimit("revision");
  if (!rateLimit.allowed) {
    await failConsultationWork(jobId, "ready_to_confirm");
    return rateLimitResponse(rateLimit);
  }
  const reserved = await beginConsultationRevision(jobId);
  if (!reserved) {
    await failConsultationWork(jobId, "ready_to_confirm");
    return Response.json({ error: "revision_limit_reached" }, { status: 409 });
  }
  try {
    const analysis = JSON.parse(claimed.analysis_json!) as HairAnalysis;
    const revision = await reviseHairRecommendations({ provider: claimed.consultation_provider, analysis, preferences });
    await completeConsultationRevision(jobId, {
      analysis: mergeRevision(analysis, revision),
      preferences: revision.preferences,
      changeSummary: revision.changeSummary,
    });
    const current = await getJob(jobId);
    return Response.json(current ? await toJobView(current) : { error: "job_not_found" });
  } catch (error) {
    await failConsultationWork(jobId, "ready_to_confirm");
    return Response.json({ error: safeErrorCode(error) }, { status: 502 });
  }
}
