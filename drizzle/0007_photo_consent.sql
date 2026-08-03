ALTER TABLE `hair_jobs` ADD `consent_version` text DEFAULT 'legacy' NOT NULL;
--> statement-breakpoint
ALTER TABLE `hair_jobs` ADD `consent_at` integer;
