ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email" varchar(120);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"title" varchar(200) NOT NULL,
	"body" text NOT NULL,
	"href" varchar(255),
	"kind" varchar(40) DEFAULT 'info' NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_app_notifications_user" ON "app_notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_app_notifications_unread" ON "app_notifications" USING btree ("user_id","is_read");
