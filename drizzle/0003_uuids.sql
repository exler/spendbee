-- Add UUID column as nullable first
ALTER TABLE `groups` ADD `uuid` text;--> statement-breakpoint

-- Generate UUIDs for existing groups (using a simple UUID-like format based on random hex)
-- Note: SQLite doesn't have built-in UUID generation, so we use random hex strings
-- In production, the application will generate proper UUIDs for new groups
UPDATE `groups` SET `uuid` = lower(
    hex(randomblob(4)) || '-' ||
    hex(randomblob(2)) || '-' ||
    '4' || substr(hex(randomblob(2)), 2) || '-' ||
    substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' ||
    hex(randomblob(6))
) WHERE `uuid` IS NULL;--> statement-breakpoint

-- Now make UUID NOT NULL and add constraints
CREATE UNIQUE INDEX `groups_uuid_unique` ON `groups` (`uuid`);--> statement-breakpoint
CREATE INDEX `groups_uuid_idx` ON `groups` (`uuid`);
