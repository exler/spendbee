ALTER TABLE `groups` ADD `share_code` text;--> statement-breakpoint
ALTER TABLE `groups` ADD `share_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `groups_share_code_unique` ON `groups` (`share_code`);--> statement-breakpoint
CREATE INDEX `groups_share_code_idx` ON `groups` (`share_code`);