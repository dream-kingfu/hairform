import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const hairJobs = sqliteTable("hair_jobs", {
  id: text("id").primaryKey(),
  tokenHash: text("token_hash").notNull(),
  status: text("status").notNull(),
  progress: integer("progress").notNull().default(0),
  originalKey: text("original_key").notNull(),
  maskKey: text("mask_key"),
  analysisJson: text("analysis_json"),
  assetsJson: text("assets_json").notNull(),
  reportKey: text("report_key"),
  previewKey: text("preview_key"),
  errorCode: text("error_code"),
  helpful: integer("helpful", { mode: "boolean" }),
  selectedStyleId: text("selected_style_id"),
  demoMode: integer("demo_mode", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
  deletedAt: integer("deleted_at"),
  workLockUntil: integer("work_lock_until"),
  generationPolicy: text("generation_policy").notNull().default("legacy-six-v1"),
  selectedAssetId: text("selected_asset_id"),
  analysisCalls: integer("analysis_calls").notNull().default(0),
  imageCalls: integer("image_calls").notNull().default(0),
  qcLunaCalls: integer("qc_luna_calls").notNull().default(0),
  qcTerraCalls: integer("qc_terra_calls").notNull().default(0),
  providerTaskId: text("provider_task_id"),
  providerTaskAttempt: integer("provider_task_attempt").notNull().default(0),
  analysisProvider: text("analysis_provider").notNull().default("kie"),
  analysisModel: text("analysis_model").notNull().default("gpt-5-6-terra"),
}, (table) => [index("hair_jobs_expires_idx").on(table.expiresAt)]);

export const rateLimitBuckets = sqliteTable("rate_limit_buckets", {
  key: text("rate_key").primaryKey(),
  count: integer("count").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
}, (table) => [index("rate_limit_buckets_expires_idx").on(table.expiresAt)]);

export const serviceState = sqliteTable("service_state", {
  key: text("state_key").primaryKey(),
  value: text("state_value").notNull(),
  updatedAt: integer("updated_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
});

export const aiRuntimeConfig = sqliteTable("ai_runtime_config", {
  id: integer("id").primaryKey(),
  analysisProvider: text("analysis_provider").notNull().default("kie"),
  analysisModel: text("analysis_model").notNull().default("gpt-5-6-terra"),
  imagePreviewEnabled: integer("image_preview_enabled", { mode: "boolean" }).notNull().default(false),
  revision: integer("revision").notNull().default(1),
  updatedAt: integer("updated_at").notNull(),
});

export const providerHealth = sqliteTable("provider_health", {
  providerId: text("provider_id").primaryKey(),
  status: text("status").notNull(),
  latencyMs: integer("latency_ms"),
  errorCode: text("error_code"),
  testedAt: integer("tested_at").notNull(),
});

export const adminSessions = sqliteTable("admin_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  csrfHash: text("csrf_hash").notNull(),
  passwordVersion: text("password_version").notNull(),
  createdAt: integer("created_at").notNull(),
  lastActiveAt: integer("last_active_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
});

export const adminAuditLog = sqliteTable("admin_audit_log", {
  id: text("id").primaryKey(),
  action: text("action").notNull(),
  providerId: text("provider_id"),
  detailsJson: text("details_json").notNull().default("{}"),
  ipFingerprint: text("ip_fingerprint"),
  createdAt: integer("created_at").notNull(),
}, (table) => [index("admin_audit_created_idx").on(table.createdAt)]);
