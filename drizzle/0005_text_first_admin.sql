ALTER TABLE `hair_jobs` ADD `analysis_provider` text DEFAULT 'kie' NOT NULL;
--> statement-breakpoint
ALTER TABLE `hair_jobs` ADD `analysis_model` text DEFAULT 'gpt-5-6-terra' NOT NULL;
--> statement-breakpoint
CREATE TABLE `ai_runtime_config` (
	`id` integer PRIMARY KEY NOT NULL,
	`analysis_provider` text DEFAULT 'kie' NOT NULL,
	`analysis_model` text DEFAULT 'gpt-5-6-terra' NOT NULL,
	`image_preview_enabled` integer DEFAULT false NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `provider_health` (
	`provider_id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`latency_ms` integer,
	`error_code` text,
	`tested_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `admin_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`csrf_hash` text NOT NULL,
	`password_version` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_active_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `admin_audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`action` text NOT NULL,
	`provider_id` text,
	`details_json` text DEFAULT '{}' NOT NULL,
	`ip_fingerprint` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `admin_audit_created_idx` ON `admin_audit_log` (`created_at`);
