CREATE TABLE "result_change_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_number" varchar(40) NOT NULL,
	"intake_id" integer NOT NULL,
	"source" varchar(20) NOT NULL,
	"reason" text NOT NULL,
	"status" varchar(30) DEFAULT 'pending_chief_instructor' NOT NULL,
	"requested_by" integer NOT NULL,
	"chief_instructor_approved_by" integer,
	"chief_instructor_approved_at" timestamp with time zone,
	"commandant_approved_by" integer,
	"commandant_approved_at" timestamp with time zone,
	"rejected_by" integer,
	"rejected_at" timestamp with time zone,
	"rejection_reason" text,
	"rejected_stage" varchar(30),
	"applied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "result_change_requests_request_number_unique" UNIQUE("request_number"),
	CONSTRAINT "result_change_requests_intake_id_fk" FOREIGN KEY ("intake_id") REFERENCES "public"."course_intakes"("intake_id") ON DELETE cascade,
	CONSTRAINT "result_change_requests_requested_by_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id"),
	CONSTRAINT "result_change_requests_ci_fk" FOREIGN KEY ("chief_instructor_approved_by") REFERENCES "public"."users"("id"),
	CONSTRAINT "result_change_requests_cmdt_fk" FOREIGN KEY ("commandant_approved_by") REFERENCES "public"."users"("id"),
	CONSTRAINT "result_change_requests_rejected_by_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."users"("id")
);--> statement-breakpoint
CREATE INDEX "idx_result_change_status" ON "result_change_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_result_change_intake" ON "result_change_requests" USING btree ("intake_id");--> statement-breakpoint
CREATE INDEX "idx_result_change_requested_by" ON "result_change_requests" USING btree ("requested_by");--> statement-breakpoint
CREATE TABLE "result_change_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"kind" varchar(20) NOT NULL,
	"enrollment_id" integer NOT NULL,
	"result_id" integer,
	"subject_name" varchar(150),
	"old_marks" numeric(6, 2),
	"old_max_marks" numeric(6, 2),
	"new_marks" numeric(6, 2),
	"new_max_marks" numeric(6, 2),
	"old_average" numeric(6, 2),
	"new_average" numeric(6, 2),
	"old_grade" varchar(2),
	"new_grade" varchar(2),
	"old_position" integer,
	"new_position" integer,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"note" text,
	CONSTRAINT "result_change_items_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."result_change_requests"("id") ON DELETE cascade,
	CONSTRAINT "result_change_items_enrollment_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("enrollment_id") ON DELETE cascade,
	CONSTRAINT "result_change_items_result_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."results"("result_id") ON DELETE set null
);--> statement-breakpoint
CREATE INDEX "idx_result_change_item_request" ON "result_change_items" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "idx_result_change_item_enrollment" ON "result_change_items" USING btree ("enrollment_id");--> statement-breakpoint
CREATE TABLE "password_reset_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token_hash" varchar(64),
	"expires_at" timestamp with time zone,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"requested_ip" varchar(64),
	"resolved_by" integer,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_requests_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade,
	CONSTRAINT "password_reset_requests_resolved_by_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id")
);--> statement-breakpoint
CREATE INDEX "idx_password_reset_user" ON "password_reset_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_password_reset_status" ON "password_reset_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_password_reset_token" ON "password_reset_requests" USING btree ("token_hash");
