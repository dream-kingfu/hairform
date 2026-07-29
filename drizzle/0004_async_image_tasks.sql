ALTER TABLE `hair_jobs` ADD `provider_task_id` text;
--> statement-breakpoint
ALTER TABLE `hair_jobs` ADD `provider_task_attempt` integer DEFAULT 0 NOT NULL;
