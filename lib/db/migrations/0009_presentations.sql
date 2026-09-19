CREATE TYPE "public"."presentation_category" AS ENUM('officers', 'other_ranks', 'external');--> statement-breakpoint
CREATE TABLE "presentations" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(200) NOT NULL,
	"category" "presentation_category" NOT NULL,
	"description" text,
	"presenter_name" varchar(120),
	"audience" varchar(200),
	"venue" varchar(200),
	"presented_at" date,
	"file_name" varchar(255) NOT NULL,
	"file_path" varchar(500) NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" varchar(120) NOT NULL,
	"uploaded_by" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "presentations_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action
);--> statement-breakpoint
CREATE INDEX "idx_presentations_category" ON "presentations" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_presentations_presented_at" ON "presentations" USING btree ("presented_at");--> statement-breakpoint
CREATE INDEX "idx_presentations_active" ON "presentations" USING btree ("is_active");
