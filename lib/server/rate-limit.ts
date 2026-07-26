import { bindings, ensureSchema } from "./jobs";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

interface BucketResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfter: number;
}

export interface RateLimitResult extends BucketResult {
  scope: "visitor_hour" | "visitor_day" | "visitor_retry" | "global_jobs" | "global_generation" | "global_analysis" | "global_qc" | "global_qc_escalation";
}

function boundedInteger(value: string | undefined, fallback: number, minimum: number, maximum: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
}

function bucketStart(now: number, duration: number) {
  return Math.floor(now / duration) * duration;
}

function clientAddress(request: Request) {
  const cloudflareIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cloudflareIp) return cloudflareIp;
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

async function fingerprint(request: Request) {
  const salt = bindings.RATE_LIMIT_SALT || "hairform-public-rate-limit-v1";
  const input = new TextEncoder().encode(`${salt}:${clientAddress(request)}`);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function consumeBucket(input: {
  key: string;
  units: number;
  limit: number;
  duration: number;
  now: number;
}): Promise<BucketResult> {
  await ensureSchema();
  const start = bucketStart(input.now, input.duration);
  const expiresAt = start + input.duration;
  const row = await bindings.DB.prepare(`INSERT INTO rate_limit_buckets (
    rate_key, count, created_at, expires_at
  ) VALUES (?, ?, ?, ?)
  ON CONFLICT(rate_key) DO UPDATE SET count = count + excluded.count
  RETURNING count`)
    .bind(`${input.key}:${start}`, input.units, input.now, expiresAt)
    .first<{ count: number }>();
  const count = row?.count ?? input.limit + input.units;
  return {
    allowed: count <= input.limit,
    limit: input.limit,
    remaining: Math.max(0, input.limit - count),
    retryAfter: Math.max(1, Math.ceil((expiresAt - input.now) / 1000)),
  };
}

async function consumeFirstBlocked(checks: Array<{
  scope: RateLimitResult["scope"];
  key: string;
  units: number;
  limit: number;
  duration: number;
}>) {
  const now = Date.now();
  let final: RateLimitResult | undefined;
  for (const check of checks) {
    const result = await consumeBucket({ ...check, now });
    final = { ...result, scope: check.scope };
    if (!result.allowed) return final;
  }
  return final!;
}

export async function consumeNewJobLimit(request: Request) {
  const visitor = await fingerprint(request);
  return consumeFirstBlocked([
    {
      scope: "visitor_hour",
      key: `new:${visitor}:hour`,
      units: 1,
      limit: boundedInteger(bindings.MAX_JOBS_PER_HOUR, 2, 1, 20),
      duration: HOUR_MS,
    },
    {
      scope: "visitor_day",
      key: `new:${visitor}:day`,
      units: 1,
      limit: boundedInteger(bindings.MAX_JOBS_PER_DAY, 5, 1, 100),
      duration: DAY_MS,
    },
    {
      scope: "global_jobs",
      key: "jobs:global:day",
      units: 1,
      limit: boundedInteger(bindings.MAX_GLOBAL_JOBS_PER_DAY, 100, 1, 100_000),
      duration: DAY_MS,
    },
  ]);
}

export async function consumeModelCallLimit(kind: "analysis" | "image" | "quality" | "quality_escalation") {
  const config = kind === "analysis"
    ? { scope: "global_analysis" as const, key: "analysis:global:day", value: bindings.MAX_ANALYSIS_CALLS_PER_DAY, fallback: 100 }
    : kind === "image"
      ? { scope: "global_generation" as const, key: "image:global:day", value: bindings.MAX_IMAGE_CALLS_PER_DAY || bindings.MAX_GENERATION_UNITS_PER_DAY, fallback: 200 }
      : kind === "quality"
        ? { scope: "global_qc" as const, key: "qc-luna:global:day", value: bindings.MAX_QC_CALLS_PER_DAY, fallback: 200 }
        : { scope: "global_qc_escalation" as const, key: "qc-terra:global:day", value: bindings.MAX_QC_ESCALATIONS_PER_DAY, fallback: 100 };
  return consumeFirstBlocked([{
    scope: config.scope,
    key: config.key,
    units: 1,
    limit: boundedInteger(config.value, config.fallback, 1, 100_000),
    duration: DAY_MS,
  }]);
}

export async function consumeRetryLimit(request: Request, units: number) {
  const visitor = await fingerprint(request);
  return consumeFirstBlocked([
    {
      scope: "visitor_retry",
      key: `retry:${visitor}:hour`,
      units,
      limit: boundedInteger(bindings.MAX_RETRIES_PER_HOUR, 6, 1, 60),
      duration: HOUR_MS,
    },
    {
      scope: "global_generation",
      key: "generation:global:day",
      units,
      limit: boundedInteger(bindings.MAX_GENERATION_UNITS_PER_DAY, 600, 6, 100_000),
      duration: DAY_MS,
    },
  ]);
}

export function rateLimitResponse(result: RateLimitResult) {
  return Response.json(
    { error: "rate_limited", retryAfter: result.retryAfter, scope: result.scope },
    {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(result.retryAfter),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
      },
    },
  );
}
