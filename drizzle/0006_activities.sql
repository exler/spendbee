CREATE TABLE `activities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`group_id` integer NOT NULL,
	`actor_member_id` integer NOT NULL,
	`type` text NOT NULL,
	`expense_id` integer,
	`settlement_id` integer,
	`from_member_id` integer,
	`to_member_id` integer,
	`amount` real,
	`currency` text,
	`metadata` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_member_id`) REFERENCES `group_members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`expense_id`) REFERENCES `expenses`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`settlement_id`) REFERENCES `settlements`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`from_member_id`) REFERENCES `group_members`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`to_member_id`) REFERENCES `group_members`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `activities_group_idx` ON `activities` (`group_id`);--> statement-breakpoint
CREATE INDEX `activities_actor_idx` ON `activities` (`actor_member_id`);--> statement-breakpoint
CREATE INDEX `activities_created_idx` ON `activities` (`created_at`);