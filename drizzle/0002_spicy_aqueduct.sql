CREATE TABLE `rate_limit_buckets` (
	`rate_key` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rate_limit_buckets_expires_idx` ON `rate_limit_buckets` (`expires_at`);--> statement-breakpoint
ALTER TABLE `hair_jobs` ADD `work_lock_until` integer;