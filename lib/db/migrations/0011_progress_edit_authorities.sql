CREATE TABLE IF NOT EXISTS "progress_edit_authorities" (
	"id" serial PRIMARY KEY NOT NULL,
	"intake_id" integer NOT NULL,
	"requested_by" integer NOT NULL,
	"reason" text NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"decided_by" integer,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	CONSTRAINT "progress_edit_authorities_intake_id_course_intakes_intake_id_fk" FOREIGN KEY ("intake_id") REFERENCES "public"."course_intakes"("intake_id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "progress_edit_authorities_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "progress_edit_authorities_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_progress_auth_intake" ON "progress_edit_authorities" USING btree ("intake_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_progress_auth_status" ON "progress_edit_authorities" USING btree ("status");
