ALTER TABLE `expenses` ADD `exchange_rate` real DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `settlements` ADD `exchange_rate` real DEFAULT 1 NOT NULL;
