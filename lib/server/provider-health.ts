import { bindings, ensureSchema, isDemoMode } from "./jobs";
import { assertProductionModelPolicy } from "./model-policy";

const API_BASE = "https://api.kie.ai";
const CREDIT_CACHE_MS = 60_000;
const FAILURE_WINDOW_MS = 10 * 60_000;
const CIRCUIT_OPEN_MS = 10 * 60_000;

function boundedNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

async function state(key: string) {
  await ensureSchema();
  return bindings.DB.prepare("SELECT state_value, expires_at FROM service_state WHERE state_key = ?")
    .bind(key)
    .first<{ state_value: string; expires_at: number }>();
}

async function putState(key: string, value: string, expiresAt: number) {
  await ensureSchema();
  const now = Date.now();
  await bindings.DB.prepare(`INSERT INTO service_state (state_key, state_value, updated_at, expires_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(state_key) DO UPDATE SET state_value = excluded.state_value,
      updated_at = excluded.updated_at, expires_at = excluded.expires_at`)
    .bind(key, value, now, expiresAt)
    .run();
}

export async function recordProviderSuccess() {
  await ensureSchema();
  await bindings.DB.prepare("DELETE FROM service_state WHERE state_key = 'kie_failure_streak'").run();
}

export async function recordProviderFailure() {
  const now = Date.now();
  const current = await state("kie_failure_streak");
  const count = current && current.expires_at > now ? Number.parseInt(current.state_value, 10) + 1 : 1;
  await putState("kie_failure_streak", String(count), now + FAILURE_WINDOW_MS);
  if (count >= 5) await putState("kie_circuit", "open", now + CIRCUIT_OPEN_MS);
}

export async function isProviderCircuitOpen() {
  const current = await state("kie_circuit");
  return Boolean(current && current.state_value === "open" && current.expires_at > Date.now());
}

async function credits() {
  const now = Date.now();
  const cached = await state("kie_credits");
  if (cached && cached.expires_at > now) return Number(cached.state_value);
  let response: Response;
  try {
    response = await fetch(`${bindings.KIE_API_BASE || API_BASE}/api/v1/chat/credit`, {
      headers: { Authorization: `Bearer ${bindings.KIE_API_KEY}` },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    await recordProviderFailure();
    throw new Error("service_temporarily_unavailable");
  }
  if (!response.ok) {
    if (response.status >= 429) await recordProviderFailure();
    throw new Error(response.status === 401 ? "invalid_api_key" : response.status === 402 ? "insufficient_credits" : "service_temporarily_unavailable");
  }
  const payload = await response.json().catch(() => ({})) as { data?: unknown };
  const value = Number(payload.data);
  if (!Number.isFinite(value)) throw new Error("service_temporarily_unavailable");
  await putState("kie_credits", String(value), now + CREDIT_CACHE_MS);
  await recordProviderSuccess();
  return value;
}

export async function ensureCanAcceptNewJob() {
  if (isDemoMode()) return;
  assertProductionModelPolicy(bindings);
  if (await isProviderCircuitOpen()) throw new Error("service_temporarily_unavailable");
  const available = await credits();
  if (available < boundedNumber(bindings.KIE_MIN_CREDITS, 120)) throw new Error("service_paused_low_credit");
}
