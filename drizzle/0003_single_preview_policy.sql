ALTER TABLE `hair_jobs` ADD `generation_policy` text DEFAULT 'legacy-six-v1' NOT NULL;
--> statement-breakpoint
ALTER TABLE `hair_jobs` ADD `selected_asset_id` text;
--> statement-breakpoint
ALTER TABLE `hair_jobs` ADD `analysis_calls` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `hair_jobs` ADD `image_calls` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `hair_jobs` ADD `qc_luna_calls` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `hair_jobs` ADD `qc_terra_calls` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TABLE `service_state` (
	`state_key` text PRIMARY KEY NOT NULL,
	`state_value` text NOT NULL,
	`updated_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
