CREATE TABLE `invitation_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token` text NOT NULL,
	`email` text NOT NULL,
	`group_id` integer NOT NULL,
	`invited_by` integer NOT NULL,
	`used` integer DEFAULT false NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invited_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE UNIQUE INDEX `invitation_tokens_token_unique` ON `invitation_tokens` (`token`);--> statement-breakpoint
CREATE INDEX `invitation_tokens_token_idx` ON `invitation_tokens` (`token`);--> statement-breakpoint
CREATE INDEX `invitation_tokens_email_idx` ON `invitation_tokens` (`email`);
