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
}, (table) => [index("hair_jobs_expires_idx").on(table.expiresAt)]);
