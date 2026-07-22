CREATE TABLE `fuel_records` (
	`id` text PRIMARY KEY NOT NULL,
	`motorcycle_id` text NOT NULL,
	`station_name` text,
	`liters` real NOT NULL,
	`price_per_liter` real NOT NULL,
	`total_cost` real NOT NULL,
	`location` text,
	`octane` text,
	`recorded_at` integer NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`motorcycle_id`) REFERENCES `motorcycles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `gps_trackers` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`motorcycle_id` text,
	`imei` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`motorcycle_id`) REFERENCES `motorcycles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `pending_otps` (
	`id` text PRIMARY KEY NOT NULL,
	`pending_user_id` text NOT NULL,
	`code` text NOT NULL,
	`tipo` text DEFAULT 'email' NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`used` integer DEFAULT false,
	`attempts` integer DEFAULT 0,
	FOREIGN KEY (`pending_user_id`) REFERENCES `pending_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `pending_users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`rut` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pending_users_email_unique` ON `pending_users` (`email`);--> statement-breakpoint
ALTER TABLE `motorcycles` ADD `color` text;--> statement-breakpoint
ALTER TABLE `users` ADD `role` text DEFAULT 'user' NOT NULL;