CREATE TABLE `municipalities` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`commune` text NOT NULL,
	`region` text NOT NULL,
	`payment_url` text DEFAULT '' NOT NULL,
	`appointment_url` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `documents` ADD `file_url_generated` text;--> statement-breakpoint
ALTER TABLE `documents` ADD `file_url_back_generated` text;--> statement-breakpoint
ALTER TABLE `motorcycles` ADD `permit_municipality_id` text REFERENCES municipalities(id);