ALTER TABLE `hair_jobs` ADD `consultation_provider` text DEFAULT 'kie' NOT NULL;
--> statement-breakpoint
ALTER TABLE `hair_jobs` ADD `consultation_model` text DEFAULT 'gpt-5-6-terra' NOT NULL;
--> statement-breakpoint
ALTER TABLE `hair_jobs` ADD `consultation_state` text DEFAULT 'idle' NOT NULL;
--> statement-breakpoint
ALTER TABLE `hair_jobs` ADD `consultation_json` text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
ALTER TABLE `hair_jobs` ADD `pending_preferences_json` text;
--> statement-breakpoint
ALTER TABLE `hair_jobs` ADD `preference_json` text;
--> statement-breakpoint
ALTER TABLE `hair_jobs` ADD `change_summary_json` text;
--> statement-breakpoint
ALTER TABLE `hair_jobs` ADD `consultation_round_turns` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `hair_jobs` ADD `consultation_calls` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `hair_jobs` ADD `revision_calls` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `ai_runtime_config` ADD `consultation_provider` text DEFAULT 'kie' NOT NULL;
--> statement-breakpoint
ALTER TABLE `ai_runtime_config` ADD `consultation_model` text DEFAULT 'gpt-5-6-terra' NOT NULL;
--> statement-breakpoint
ALTER TABLE `ai_runtime_config` ADD `consultation_enabled` integer DEFAULT false NOT NULL;
