CREATE TABLE `api_token` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `feed` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`folder_id` integer,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`site_url` text,
	`etag` text,
	`last_modified` text,
	`last_fetched_at` text,
	`last_status` text,
	`last_error` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`folder_id`) REFERENCES `folder`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `feed_url_unique` ON `feed` (`url`);--> statement-breakpoint
CREATE INDEX `feed_fetched_idx` ON `feed` (`last_fetched_at`);--> statement-breakpoint
CREATE TABLE `folder` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `folder_name_unique` ON `folder` (`name`);--> statement-breakpoint
CREATE TABLE `item` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`feed_id` integer NOT NULL,
	`guid` text NOT NULL,
	`url` text NOT NULL,
	`title` text NOT NULL,
	`kind` text NOT NULL,
	`published_at` text NOT NULL,
	`read_at` text,
	FOREIGN KEY (`feed_id`) REFERENCES `feed`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `item_guid_idx` ON `item` (`feed_id`,`guid`);--> statement-breakpoint
CREATE INDEX `item_published_idx` ON `item` (`published_at`);--> statement-breakpoint
CREATE INDEX `item_unread_idx` ON `item` (`read_at`);--> statement-breakpoint
CREATE TABLE `saved` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`url` text NOT NULL,
	`title` text NOT NULL,
	`kind` text NOT NULL,
	`added_at` text NOT NULL,
	`archived_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `saved_url_unique` ON `saved` (`url`);--> statement-breakpoint
CREATE INDEX `saved_list_idx` ON `saved` (`archived_at`,`added_at`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `session_user_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `sync_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`feed_id` integer NOT NULL,
	`at` text NOT NULL,
	`status` text NOT NULL,
	`http_status` integer,
	`items_added` integer DEFAULT 0 NOT NULL,
	`error` text,
	`ms` integer NOT NULL,
	FOREIGN KEY (`feed_id`) REFERENCES `feed`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sync_log_feed_idx` ON `sync_log` (`feed_id`,`at`);--> statement-breakpoint
CREATE INDEX `sync_log_at_idx` ON `sync_log` (`at`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);