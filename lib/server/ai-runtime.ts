import type { AnalysisProvider } from "@/lib/hair/types";
import { ANALYSIS_MODEL_ALLOWLIST } from "./model-policy";
import { bindings, ensureSchema, getRuntimeAiConfig } from "./jobs";
import { isAnalysisProviderConfigured, testAnalysisProvider } from "./openai";

const PROVIDERS: AnalysisProvider[] = ["kie", "qwen", "glm"];
const HEALTH_TTL_MS = 30 * 60_000;

export function isAnalysisProvider(value: unknown): value is AnalysisProvider {
  return typeof value === "string" && PROVIDERS.includes(value as AnalysisProvider);
}

export async function writeAdminAudit(action: string, input: { providerId?: AnalysisProvider; details?: Record<string, unknown>; ipFingerprint?: string } = {}) {
  await ensureSchema();
  await bindings.DB.prepare(`INSERT INTO admin_audit_log (
    id, action, provider_id, details_json, ip_fingerprint, created_at
  ) VALUES (?, ?, ?, ?, ?, ?)`).bind(
    crypto.randomUUID(), action, input.providerId ?? null,
    JSON.stringify(input.details ?? {}), input.ipFingerprint ?? null, Date.now(),
  ).run();
}

export async function providerConfiguration() {
  return PROVIDERS.map((id) => ({
    id,
    model: ANALYSIS_MODEL_ALLOWLIST[id],
    keyConfigured: isAnalysisProviderConfigured(id),
  }));
}

export async function getProviderHealth() {
  await ensureSchema();
  const rows = await bindings.DB.prepare("SELECT * FROM provider_health").all<{
    provider_id: string; status: string; latency_ms: number | null; error_code: string | null; tested_at: number;
  }>();
  return rows.results.filter((row) => isAnalysisProvider(row.provider_id)).map((row) => ({
    providerId: row.provider_id as AnalysisProvider,
    status: row.status === "ok" ? "ok" as const : "failed" as const,
    latencyMs: row.latency_ms ?? undefined,
    errorCode: row.error_code ?? undefined,
    testedAt: new Date(row.tested_at).toISOString(),
    fresh: row.status === "ok" && Date.now() - row.tested_at <= HEALTH_TTL_MS,
  }));
}

export async function runProviderHealthTest(providerId: AnalysisProvider, ipFingerprint?: string) {
  await ensureSchema();
  let status: "ok" | "failed" = "ok";
  let latencyMs: number | null = null;
  let errorCode: string | null = null;
  try {
    const result = await testAnalysisProvider(providerId);
    latencyMs = result.latencyMs;
  } catch (error) {
    status = "failed";
    errorCode = error instanceof Error ? error.message : "model_request_failed";
  }
  const testedAt = Date.now();
  await bindings.DB.prepare(`INSERT INTO provider_health (provider_id, status, latency_ms, error_code, tested_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(provider_id) DO UPDATE SET status = excluded.status, latency_ms = excluded.latency_ms,
      error_code = excluded.error_code, tested_at = excluded.tested_at`)
    .bind(providerId, status, latencyMs, errorCode, testedAt).run();
  await writeAdminAudit("provider_test", { providerId, details: { status, latencyMs, errorCode }, ipFingerprint });
  return { providerId, status, latencyMs: latencyMs ?? undefined, errorCode: errorCode ?? undefined, testedAt: new Date(testedAt).toISOString(), fresh: status === "ok" };
}

export async function updateRuntimeConfig(input: {
  revision: number;
  analysisProvider: AnalysisProvider;
  imagePreviewEnabled: boolean;
  ipFingerprint?: string;
}) {
  await ensureSchema();
  const current = await getRuntimeAiConfig();
  if (input.analysisProvider !== current.analysisProvider) {
    if (!isAnalysisProviderConfigured(input.analysisProvider)) throw new Error("provider_not_configured");
    const health = await bindings.DB.prepare("SELECT status, tested_at FROM provider_health WHERE provider_id = ?")
      .bind(input.analysisProvider).first<{ status: string; tested_at: number }>();
    if (!health || health.status !== "ok" || Date.now() - health.tested_at > HEALTH_TTL_MS) throw new Error("provider_health_required");
  }
  const now = Date.now();
  const updated = await bindings.DB.prepare(`UPDATE ai_runtime_config SET
    analysis_provider = ?, analysis_model = ?, image_preview_enabled = ?, revision = revision + 1, updated_at = ?
    WHERE id = 1 AND revision = ? RETURNING revision`)
    .bind(input.analysisProvider, ANALYSIS_MODEL_ALLOWLIST[input.analysisProvider], input.imagePreviewEnabled ? 1 : 0, now, input.revision)
    .first<{ revision: number }>();
  if (!updated) throw new Error("config_conflict");
  if (input.analysisProvider !== current.analysisProvider) {
    await writeAdminAudit("provider_switch", { providerId: input.analysisProvider, details: { from: current.analysisProvider, revision: updated.revision }, ipFingerprint: input.ipFingerprint });
  }
  if (input.imagePreviewEnabled !== current.imagePreviewEnabled) {
    await writeAdminAudit("image_preview_toggle", { details: { enabled: input.imagePreviewEnabled, revision: updated.revision }, ipFingerprint: input.ipFingerprint });
  }
  return getRuntimeAiConfig();
}

export async function adminDashboardData() {
  await ensureSchema();
  const [config, providers, health, usage, audit] = await Promise.all([
    getRuntimeAiConfig(), providerConfiguration(), getProviderHealth(),
    bindings.DB.prepare(`SELECT
      COALESCE(SUM(analysis_calls), 0) AS analyses,
      SUM(CASE WHEN status IN ('analysis_ready','awaiting_selection','generating','compositing','completed','partial') THEN 1 ELSE 0 END) AS successes,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failures,
      COALESCE(SUM(image_calls), 0) AS image_calls
      FROM hair_jobs WHERE created_at >= ?`).bind(new Date().setHours(0, 0, 0, 0)).first<{ analyses: number; successes: number; failures: number; image_calls: number }>(),
    bindings.DB.prepare("SELECT action, provider_id, details_json, created_at FROM admin_audit_log ORDER BY created_at DESC LIMIT 30")
      .all<{ action: string; provider_id: string | null; details_json: string; created_at: number }>(),
  ]);
  return {
    config,
    providers: providers.map((provider) => ({ ...provider, health: health.find((item) => item.providerId === provider.id) })),
    usage: usage ?? { analyses: 0, successes: 0, failures: 0, image_calls: 0 },
    audit: audit.results.map((row) => ({ action: row.action, providerId: row.provider_id, details: JSON.parse(row.details_json), createdAt: new Date(row.created_at).toISOString() })),
  };
}
