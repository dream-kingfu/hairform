import { authorizeJob, claimConsultationJob, failConsultationWork, getJob, getRuntimeAiConfig, parseConsultationMessages, saveConsultationTurn, toJobView } from "@/lib/server/jobs";
import { consultHairPreferences, isAnalysisProviderConfigured, safeErrorCode } from "@/lib/server/openai";
import { consumeConsultationCallLimit, rateLimitResponse } from "@/lib/server/rate-limit";
import type { HairAnalysis } from "@/lib/hair/types";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ jobId: string }> };

export async function POST(request: Request, context: Context) {
  const { jobId } = await context.params;
  const job = await authorizeJob(request, jobId);
  if (!job) return Response.json({ error: "job_not_found" }, { status: 404 });
  const runtime = await getRuntimeAiConfig();
  if (!runtime.consultationEnabled) return Response.json({ error: "consultation_disabled" }, { status: 403 });
  if (!job.analysis_json || !["analysis_ready", "awaiting_selection"].includes(job.status) || job.selected_asset_id) return Response.json({ error: "consultation_locked" }, { status: 409 });
  if (job.revision_calls >= 2) return Response.json({ error: "revision_limit_reached" }, { status: 409 });
  const payload = await request.json().catch(() => ({})) as { message?: unknown; model?: unknown };
  if (payload.model !== undefined) return Response.json({ error: "model_not_allowed" }, { status: 400 });
  const message = typeof payload.message === "string" ? payload.message.trim() : "";
  if (!message || message.length > 500) return Response.json({ error: "invalid_consultation_message" }, { status: 400 });
  if (job.consultation_round_turns >= 2) return Response.json({ error: "consultation_turn_limit" }, { status: 409 });
  if (!isAnalysisProviderConfigured(job.consultation_provider)) return Response.json({ error: "provider_not_configured" }, { status: 503 });

  const claimed = await claimConsultationJob(jobId, ["idle", "revised", "clarifying", "ready_to_confirm"]);
  if (!claimed) return Response.json({ error: "job_busy" }, { status: 409 });
  const rateLimit = await consumeConsultationCallLimit("consultation");
  if (!rateLimit.allowed) {
    await failConsultationWork(jobId, job.consultation_state);
    return rateLimitResponse(rateLimit);
  }
  try {
    const turn = claimed.consultation_round_turns + 1;
    const messages = [...parseConsultationMessages(claimed), { role: "user" as const, content: message }];
    const result = await consultHairPreferences({
      provider: claimed.consultation_provider,
      analysis: JSON.parse(claimed.analysis_json!) as HairAnalysis,
      messages,
      turn,
    });
    await saveConsultationTurn(jobId, {
      state: result.state,
      messages: [...messages, { role: "assistant", content: result.reply }],
      preferences: result.preferences,
      turns: turn,
    });
    const current = await getJob(jobId);
    return Response.json(current ? await toJobView(current) : { error: "job_not_found" });
  } catch (error) {
    await failConsultationWork(jobId, job.consultation_state);
    return Response.json({ error: safeErrorCode(error) }, { status: 502 });
  }
}
