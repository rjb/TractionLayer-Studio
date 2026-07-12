ALTER TABLE `workflows` RENAME COLUMN `description` TO `short_description`;--> statement-breakpoint
ALTER TABLE `workflows` ADD `long_description` text;