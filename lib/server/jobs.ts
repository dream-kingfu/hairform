import { env } from "cloudflare:workers";
import type { AnalysisProvider, AssetId, HairAnalysis, HairJobView, JobAsset, JobStatus, PreviewAssetId } from "@/lib/hair/types";
import { buildHairPresentation } from "@/lib/hair/presentation";

interface RuntimeBindings {
  DB: D1Database;
  HAIR_ASSETS: R2Bucket;
  AI_PROVIDER?: string;
  OPENAI_API_KEY?: string;
  KIE_API_KEY?: string;
  KIE_API_BASE?: string;
  KIE_UPLOAD_BASE?: string;
  KIE_ANALYSIS_MODEL?: string;
  KIE_QC_MODEL?: string;
  KIE_IMAGE_MODEL?: string;
  QWEN_API_KEY?: string;
  QWEN_API_BASE?: string;
  GLM_API_KEY?: string;
  GLM_API_BASE?: string;
  ADMIN_PASSWORD_HASH?: string;
  ADMIN_PASSWORD_VERSION?: string;
  ADMIN_SESSION_SECRET?: string;
  ANALYSIS_MODEL?: string;
  IMAGE_MODEL?: string;
  DEMO_MODE?: string;
  RATE_LIMIT_SALT?: string;
  RATE_LIMIT_IP_ALLOWLIST?: string;
  MAX_JOBS_PER_HOUR?: string;
  MAX_JOBS_PER_DAY?: string;
  MAX_RETRIES_PER_HOUR?: string;
  MAX_GENERATION_UNITS_PER_DAY?: string;
  MAX_GLOBAL_JOBS_PER_DAY?: string;
  MAX_IMAGE_CALLS_PER_DAY?: string;
  MAX_ANALYSIS_CALLS_PER_DAY?: string;
  MAX_QC_CALLS_PER_DAY?: string;
  MAX_QC_ESCALATIONS_PER_DAY?: string;
  KIE_MIN_CREDITS?: string;
  GENERATION_CONCURRENCY?: string;
}

export interface StoredJob {
  id: string;
  token_hash: string;
  status: JobStatus;
  progress: number;
  original_key: string;
  mask_key: string | null;
  analysis_json: string | null;
  assets_json: string;
  report_key: string | null;
  preview_key: string | null;
  error_code: string | null;
  demo_mode: number;
  created_at: number;
  updated_at: number;
  expires_at: number;
  deleted_at: number | null;
  work_lock_until: number | null;
  generation_policy: string | null;
  selected_asset_id: string | null;
  analysis_calls: number;
  image_calls: number;
  qc_luna_calls: number;
  qc_terra_calls: number;
  provider_task_id: string | null;
  provider_task_attempt: number;
  analysis_provider: AnalysisProvider;
  analysis_model: string;
}

export const bindings = env as unknown as RuntimeBindings;
const DAY_MS = 24 * 60 * 60 * 1000;
let schemaReady = false;

export const DEFAULT_ASSETS: JobAsset[] = [
  { id: "best_short", kind: "hairstyle", status: "not_requested" },
  { id: "best_medium", kind: "hairstyle", status: "not_requested" },
  { id: "best_long", kind: "hairstyle", status: "not_requested" },
  { id: "less_suitable", kind: "hairstyle", status: "not_requested" },
  { id: "color_primary", kind: "color", status: "not_requested" },
  { id: "color_secondary", kind: "color", status: "not_requested" },
];

export const LEGACY_ASSETS: JobAsset[] = DEFAULT_ASSETS.map((asset) => ({ ...asset, status: "pending" }));

export async function ensureSchema() {
  if (schemaReady) return;
  if (!bindings.DB) throw new Error("storage_unavailable");
  await bindings.DB.batch([
    bindings.DB.prepare(`CREATE TABLE IF NOT EXISTS hair_jobs (
      id TEXT PRIMARY KEY,
      token_hash TEXT NOT NULL,
      status TEXT NOT NULL,
      progress INTEGER NOT NULL DEFAULT 0,
      original_key TEXT NOT NULL,
      mask_key TEXT,
      analysis_json TEXT,
      assets_json TEXT NOT NULL,
      report_key TEXT,
      preview_key TEXT,
      error_code TEXT,
      helpful INTEGER,
      selected_style_id TEXT,
      demo_mode INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      deleted_at INTEGER,
      work_lock_until INTEGER,
      generation_policy TEXT NOT NULL DEFAULT 'legacy-six-v1',
      selected_asset_id TEXT,
      analysis_calls INTEGER NOT NULL DEFAULT 0,
      image_calls INTEGER NOT NULL DEFAULT 0,
      qc_luna_calls INTEGER NOT NULL DEFAULT 0,
      qc_terra_calls INTEGER NOT NULL DEFAULT 0,
      provider_task_id TEXT,
      provider_task_attempt INTEGER NOT NULL DEFAULT 0
    )`),
    bindings.DB.prepare("CREATE INDEX IF NOT EXISTS hair_jobs_expires_idx ON hair_jobs (expires_at)"),
    bindings.DB.prepare(`CREATE TABLE IF NOT EXISTS rate_limit_buckets (
      rate_key TEXT PRIMARY KEY,
      count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    )`),
    bindings.DB.prepare("CREATE INDEX IF NOT EXISTS rate_limit_buckets_expires_idx ON rate_limit_buckets (expires_at)"),
    bindings.DB.prepare(`CREATE TABLE IF NOT EXISTS service_state (
      state_key TEXT PRIMARY KEY,
      state_value TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    )`),
    bindings.DB.prepare(`CREATE TABLE IF NOT EXISTS ai_runtime_config (
      id INTEGER PRIMARY KEY,
      analysis_provider TEXT NOT NULL DEFAULT 'kie',
      analysis_model TEXT NOT NULL DEFAULT 'gpt-5-6-terra',
      image_preview_enabled INTEGER NOT NULL DEFAULT 0,
      revision INTEGER NOT NULL DEFAULT 1,
      updated_at INTEGER NOT NULL
    )`),
    bindings.DB.prepare(`CREATE TABLE IF NOT EXISTS provider_health (
      provider_id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      latency_ms INTEGER,
      error_code TEXT,
      tested_at INTEGER NOT NULL
    )`),
    bindings.DB.prepare(`CREATE TABLE IF NOT EXISTS admin_sessions (
      token_hash TEXT PRIMARY KEY,
      csrf_hash TEXT NOT NULL,
      password_version TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      last_active_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    )`),
    bindings.DB.prepare(`CREATE TABLE IF NOT EXISTS admin_audit_log (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      provider_id TEXT,
      details_json TEXT NOT NULL DEFAULT '{}',
      ip_fingerprint TEXT,
      created_at INTEGER NOT NULL
    )`),
    bindings.DB.prepare("CREATE INDEX IF NOT EXISTS admin_audit_created_idx ON admin_audit_log (created_at)"),
    bindings.DB.prepare(`INSERT INTO ai_runtime_config (
      id, analysis_provider, analysis_model, image_preview_enabled, revision, updated_at
    ) VALUES (1, 'kie', 'gpt-5-6-terra', 0, 1, ?)
    ON CONFLICT(id) DO NOTHING`).bind(Date.now()),
  ]);
  const columns = await bindings.DB.prepare("PRAGMA table_info(hair_jobs)").all<{ name: string }>();
  const additions = [
    ["work_lock_until", "ALTER TABLE hair_jobs ADD COLUMN work_lock_until INTEGER"],
    ["generation_policy", "ALTER TABLE hair_jobs ADD COLUMN generation_policy TEXT NOT NULL DEFAULT 'legacy-six-v1'"],
    ["selected_asset_id", "ALTER TABLE hair_jobs ADD COLUMN selected_asset_id TEXT"],
    ["analysis_calls", "ALTER TABLE hair_jobs ADD COLUMN analysis_calls INTEGER NOT NULL DEFAULT 0"],
    ["image_calls", "ALTER TABLE hair_jobs ADD COLUMN image_calls INTEGER NOT NULL DEFAULT 0"],
    ["qc_luna_calls", "ALTER TABLE hair_jobs ADD COLUMN qc_luna_calls INTEGER NOT NULL DEFAULT 0"],
    ["qc_terra_calls", "ALTER TABLE hair_jobs ADD COLUMN qc_terra_calls INTEGER NOT NULL DEFAULT 0"],
    ["provider_task_id", "ALTER TABLE hair_jobs ADD COLUMN provider_task_id TEXT"],
    ["provider_task_attempt", "ALTER TABLE hair_jobs ADD COLUMN provider_task_attempt INTEGER NOT NULL DEFAULT 0"],
    ["analysis_provider", "ALTER TABLE hair_jobs ADD COLUMN analysis_provider TEXT NOT NULL DEFAULT 'kie'"],
    ["analysis_model", "ALTER TABLE hair_jobs ADD COLUMN analysis_model TEXT NOT NULL DEFAULT 'gpt-5-6-terra'"],
  ] as const;
  for (const [name, sql] of additions) {
    if (!columns.results.some((column) => column.name === name)) await bindings.DB.prepare(sql).run();
  }
  schemaReady = true;
}

export function createJobIdentity() {
  return {
    jobId: crypto.randomUUID(),
    token: `${crypto.randomUUID()}${crypto.randomUUID().replaceAll("-", "")}`,
  };
}

export async function hashToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function isDemoMode() {
  return bindings.DEMO_MODE === "true";
}

export function jobCookieName(jobId: string) {
  return `hair_job_${jobId.replaceAll("-", "_")}`;
}

export function jobCookie(jobId: string, token: string, maxAge = 86400, secure = true) {
  return `${jobCookieName(jobId)}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}

function cookieValue(request: Request, name: string) {
  const raw = request.headers.get("cookie") ?? "";
  return raw.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
}

export async function authorizeJob(request: Request, jobId: string) {
  await ensureSchema();
  const job = await getJob(jobId);
  if (!job) return null;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const token = bearer || cookieValue(request, jobCookieName(jobId));
  if (!token || (await hashToken(token)) !== job.token_hash) return null;
  if (job.expires_at <= Date.now() && job.status !== "expired") {
    await expireJob(job);
    return { ...job, status: "expired" as const };
  }
  return job;
}

export async function getJob(jobId: string) {
  await ensureSchema();
  return bindings.DB.prepare("SELECT * FROM hair_jobs WHERE id = ?")
    .bind(jobId)
    .first<StoredJob>();
}

export async function insertJob(input: {
  id: string;
  tokenHash: string;
  originalKey: string;
  maskKey?: string;
  demoMode: boolean;
  analysisProvider: AnalysisProvider;
  analysisModel: string;
}) {
  await ensureSchema();
  const now = Date.now();
  const expiresAt = now + DAY_MS;
  await bindings.DB.prepare(`INSERT INTO hair_jobs (
    id, token_hash, status, progress, original_key, mask_key, assets_json,
    demo_mode, generation_policy, analysis_provider, analysis_model, created_at, updated_at, expires_at
  ) VALUES (?, ?, 'validating', 4, ?, ?, ?, ?, 'text-first-v1', ?, ?, ?, ?, ?)`)
    .bind(input.id, input.tokenHash, input.originalKey, input.maskKey ?? null, JSON.stringify(DEFAULT_ASSETS), input.demoMode ? 1 : 0, input.analysisProvider, input.analysisModel, now, now, expiresAt)
    .run();
  return { expiresAt };
}

export async function updateJob(jobId: string, patch: {
  status?: JobStatus;
  progress?: number;
  analysis?: HairAnalysis;
  assets?: JobAsset[];
  reportKey?: string | null;
  previewKey?: string | null;
  errorCode?: string | null;
  workLockUntil?: number | null;
  providerTaskId?: string | null;
  providerTaskAttempt?: number;
}) {
  const current = await getJob(jobId);
  if (!current) throw new Error("job_not_found");
  await bindings.DB.prepare(`UPDATE hair_jobs SET
    status = ?, progress = ?, analysis_json = ?, assets_json = ?, report_key = ?,
    preview_key = ?, error_code = ?, work_lock_until = ?, provider_task_id = ?,
    provider_task_attempt = ?, updated_at = ? WHERE id = ?`)
    .bind(
      patch.status ?? current.status,
      patch.progress ?? current.progress,
      patch.analysis === undefined ? current.analysis_json : JSON.stringify(patch.analysis),
      patch.assets === undefined ? current.assets_json : JSON.stringify(patch.assets),
      patch.reportKey === undefined ? current.report_key : patch.reportKey,
      patch.previewKey === undefined ? current.preview_key : patch.previewKey,
      patch.errorCode === undefined ? current.error_code : patch.errorCode,
      patch.workLockUntil === undefined ? current.work_lock_until : patch.workLockUntil,
      patch.providerTaskId === undefined ? current.provider_task_id : patch.providerTaskId,
      patch.providerTaskAttempt ?? current.provider_task_attempt,
      Date.now(),
      jobId,
    )
    .run();
}

const WORK_LOCK_MS = 6 * 60 * 1000;

export async function claimInitialJob(jobId: string) {
  await ensureSchema();
  const now = Date.now();
  return bindings.DB.prepare(`UPDATE hair_jobs SET
    status = 'analyzing', progress = 12, work_lock_until = ?, updated_at = ?
    WHERE id = ? AND status = 'validating'
      AND (work_lock_until IS NULL OR work_lock_until <= ?)
    RETURNING *`)
    .bind(now + WORK_LOCK_MS, now, jobId, now)
    .first<StoredJob>();
}

export async function claimRetryJob(jobId: string) {
  await ensureSchema();
  const now = Date.now();
  return bindings.DB.prepare(`UPDATE hair_jobs SET
    status = 'generating', progress = 24, work_lock_until = ?, updated_at = ?
    WHERE id = ? AND status IN ('completed', 'partial', 'failed')
      AND (work_lock_until IS NULL OR work_lock_until <= ?)
    RETURNING *`)
    .bind(now + WORK_LOCK_MS, now, jobId, now)
    .first<StoredJob>();
}

export async function claimGenerationJob(jobId: string, assetId: PreviewAssetId) {
  await ensureSchema();
  const now = Date.now();
  return bindings.DB.prepare(`UPDATE hair_jobs SET
    status = 'generating', progress = 42, selected_asset_id = ?, provider_task_id = NULL,
    provider_task_attempt = 0, work_lock_until = ?, updated_at = ?
    WHERE id = ? AND generation_policy IN ('single-preview-v1', 'text-first-v1')
      AND status IN ('analysis_ready', 'awaiting_selection', 'completed', 'partial') AND selected_asset_id IS NULL
      AND (work_lock_until IS NULL OR work_lock_until <= ?)
    RETURNING *`)
    .bind(assetId, now + WORK_LOCK_MS, now, jobId, now)
    .first<StoredJob>();
}

export async function claimGenerationPoll(jobId: string) {
  await ensureSchema();
  const now = Date.now();
  return bindings.DB.prepare(`UPDATE hair_jobs SET work_lock_until = ?, updated_at = ?
    WHERE id = ? AND status = 'generating' AND provider_task_id IS NOT NULL
      AND (work_lock_until IS NULL OR work_lock_until <= ?)
    RETURNING *`)
    .bind(now + 60_000, now, jobId, now)
    .first<StoredJob>();
}

type JobCallKind = "analysis" | "image" | "quality" | "quality_escalation";
const CALL_COLUMNS: Record<JobCallKind, string> = {
  analysis: "analysis_calls",
  image: "image_calls",
  quality: "qc_luna_calls",
  quality_escalation: "qc_terra_calls",
};

export async function reserveJobCall(jobId: string, kind: JobCallKind, limit: number) {
  await ensureSchema();
  const column = CALL_COLUMNS[kind];
  const row = await bindings.DB.prepare(`UPDATE hair_jobs SET ${column} = ${column} + 1, updated_at = ?
    WHERE id = ? AND ${column} < ? RETURNING ${column} AS count`)
    .bind(Date.now(), jobId, limit)
    .first<{ count: number }>();
  return row?.count;
}

export async function failJobWork(jobId: string, errorCode: string) {
  await ensureSchema();
  await bindings.DB.prepare(`UPDATE hair_jobs SET
    status = 'failed', error_code = ?, work_lock_until = NULL, provider_task_id = NULL, updated_at = ?
    WHERE id = ?`)
    .bind(errorCode, Date.now(), jobId)
    .run();
}

export async function saveFeedback(jobId: string, helpful: boolean, selectedStyleId?: string) {
  await bindings.DB.prepare("UPDATE hair_jobs SET helpful = ?, selected_style_id = ?, updated_at = ? WHERE id = ?")
    .bind(helpful ? 1 : 0, selectedStyleId ?? null, Date.now(), jobId)
    .run();
}

export function parseAssets(job: StoredJob): JobAsset[] {
  try { return JSON.parse(job.assets_json) as JobAsset[]; }
  catch { return job.generation_policy === "single-preview-v1" ? DEFAULT_ASSETS : LEGACY_ASSETS; }
}

export interface RuntimeAiConfig {
  analysisProvider: AnalysisProvider;
  analysisModel: string;
  imagePreviewEnabled: boolean;
  revision: number;
  updatedAt: number;
}

export const PROVIDER_MODELS: Record<AnalysisProvider, string> = {
  kie: "gpt-5-6-terra",
  qwen: "qwen3.6-flash",
  glm: "glm-4.6v-flash",
};

export async function getRuntimeAiConfig(): Promise<RuntimeAiConfig> {
  await ensureSchema();
  const row = await bindings.DB.prepare("SELECT * FROM ai_runtime_config WHERE id = 1")
    .first<{ analysis_provider: string; analysis_model: string; image_preview_enabled: number; revision: number; updated_at: number }>();
  const analysisProvider = row && ["kie", "qwen", "glm"].includes(row.analysis_provider)
    ? row.analysis_provider as AnalysisProvider
    : "kie";
  return {
    analysisProvider,
    analysisModel: PROVIDER_MODELS[analysisProvider],
    imagePreviewEnabled: Boolean(row?.image_preview_enabled),
    revision: row?.revision ?? 1,
    updatedAt: row?.updated_at ?? Date.now(),
  };
}

export async function toJobView(job: StoredJob): Promise<HairJobView> {
  const runtime = await getRuntimeAiConfig();
  const analysis = job.analysis_json ? JSON.parse(job.analysis_json) as HairAnalysis : undefined;
  const assets = parseAssets(job).map((asset) => ({
    ...asset,
    url: asset.status === "ready" ? `/api/v1/hair-jobs/${job.id}/assets/${asset.id}` : undefined,
  }));
  return {
    id: job.id,
    status: job.status,
    progress: job.progress,
    analysis,
    assets,
    originalUrl: job.status !== "deleted" && job.status !== "expired" ? `/api/v1/hair-jobs/${job.id}/assets/original` : undefined,
    reportUrl: job.report_key ? `/api/v1/hair-jobs/${job.id}/assets/report` : undefined,
    previewUrl: job.preview_key ? `/api/v1/hair-jobs/${job.id}/assets/report_preview` : undefined,
    expiresAt: new Date(job.expires_at).toISOString(),
    demoMode: Boolean(job.demo_mode),
    errorCode: job.error_code ?? undefined,
    presentation: analysis ? buildHairPresentation(analysis) : undefined,
    generationPolicy: {
      version: job.generation_policy === "text-first-v1" ? "text-first-v1" : job.generation_policy === "single-preview-v1" ? "single-preview-v1" : "legacy-six-v1",
      selectableAssetIds: ["best_short", "best_medium", "best_long", "color_primary", "color_secondary"],
      selectedAssetId: ["best_short", "best_medium", "best_long", "color_primary", "color_secondary"].includes(job.selected_asset_id ?? "")
        ? job.selected_asset_id as PreviewAssetId
        : undefined,
      imageCallsUsed: job.image_calls ?? 0,
      imageCallsLimit: ["single-preview-v1", "text-first-v1"].includes(job.generation_policy ?? "") ? 2 : 12,
      imagePreviewAvailable: runtime.imagePreviewEnabled,
    },
    analysisProvider: job.analysis_provider,
    analysisModel: job.analysis_model,
  };
}

export async function putAsset(key: string, value: ArrayBuffer | ReadableStream, contentType: string) {
  if (!bindings.HAIR_ASSETS) throw new Error("asset_storage_unavailable");
  await bindings.HAIR_ASSETS.put(key, value, { httpMetadata: { contentType } });
}

export async function deleteJobObjects(jobId: string) {
  if (!bindings.HAIR_ASSETS) return;
  let cursor: string | undefined;
  do {
    const listed = await bindings.HAIR_ASSETS.list({ prefix: `jobs/${jobId}/`, cursor });
    if (listed.objects.length) await bindings.HAIR_ASSETS.delete(listed.objects.map((object) => object.key));
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
}

async function expireJob(job: StoredJob) {
  await deleteJobObjects(job.id);
  await bindings.DB.prepare("UPDATE hair_jobs SET status = 'expired', progress = 100, analysis_json = NULL, assets_json = '[]', report_key = NULL, preview_key = NULL, updated_at = ? WHERE id = ?")
    .bind(Date.now(), job.id)
    .run();
}

export async function deleteJob(job: StoredJob) {
  await deleteJobObjects(job.id);
  await bindings.DB.prepare("UPDATE hair_jobs SET status = 'deleted', progress = 100, analysis_json = NULL, assets_json = '[]', report_key = NULL, preview_key = NULL, deleted_at = ?, updated_at = ? WHERE id = ?")
    .bind(Date.now(), Date.now(), job.id)
    .run();
}

export async function cleanupExpiredJobs() {
  await ensureSchema();
  const result = await bindings.DB.prepare("SELECT * FROM hair_jobs WHERE expires_at <= ? AND status NOT IN ('expired', 'deleted') LIMIT 20")
    .bind(Date.now())
    .all<StoredJob>();
  for (const job of result.results) await expireJob(job);
  await bindings.DB.prepare("DELETE FROM rate_limit_buckets WHERE expires_at <= ?")
    .bind(Date.now())
    .run();
  await bindings.DB.prepare("DELETE FROM service_state WHERE expires_at <= ?")
    .bind(Date.now())
    .run();
  await bindings.DB.prepare("DELETE FROM admin_sessions WHERE expires_at <= ?")
    .bind(Date.now())
    .run();
}

export function assetKey(jobId: string, id: AssetId | "original" | "mask" | "report" | "report_preview") {
  const extension = id === "report_preview" ? "webp" : "png";
  return `jobs/${jobId}/${id}.${extension}`;
}
