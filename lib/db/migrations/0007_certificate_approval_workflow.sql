ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'chief_instructor';--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'commandant';--> statement-breakpoint
CREATE TYPE "public"."certificate_request_status" AS ENUM('draft', 'pending_chief_instructor', 'pending_commandant', 'approved', 'rejected', 'cancelled', 'issued', 'partially_issued');--> statement-breakpoint
CREATE TYPE "public"."certificate_request_item_status" AS ENUM('pending', 'issued', 'removed');--> statement-breakpoint
CREATE TABLE "certificate_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_number" varchar(40) NOT NULL,
	"course_id" integer NOT NULL,
	"intake_id" integer NOT NULL,
	"status" "certificate_request_status" DEFAULT 'draft' NOT NULL,
	"certificate_count" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_by" integer NOT NULL,
	"submitted_at" timestamp with time zone,
	"chief_instructor_approved_by" integer,
	"chief_instructor_approved_at" timestamp with time zone,
	"commandant_approved_by" integer,
	"commandant_approved_at" timestamp with time zone,
	"rejected_by" integer,
	"rejected_at" timestamp with time zone,
	"rejection_reason" text,
	"rejected_stage" varchar(30),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "certificate_requests_request_number_unique" UNIQUE("request_number"),
	CONSTRAINT "certificate_requests_course_id_courses_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("course_id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "certificate_requests_intake_id_course_intakes_intake_id_fk" FOREIGN KEY ("intake_id") REFERENCES "public"."course_intakes"("intake_id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "certificate_requests_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "certificate_requests_chief_instructor_approved_by_users_id_fk" FOREIGN KEY ("chief_instructor_approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "certificate_requests_commandant_approved_by_users_id_fk" FOREIGN KEY ("commandant_approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "certificate_requests_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action
);--> statement-breakpoint
CREATE TABLE "certificate_request_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"enrollment_id" integer NOT NULL,
	"student_army_number" varchar(20) NOT NULL,
	"status" "certificate_request_item_status" DEFAULT 'pending' NOT NULL,
	"certificate_id" integer,
	"issued_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "certificate_request_items_request_id_certificate_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."certificate_requests"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "certificate_request_items_enrollment_id_enrollments_enrollment_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("enrollment_id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "certificate_request_items_certificate_id_certificates_certificate_id_fk" FOREIGN KEY ("certificate_id") REFERENCES "public"."certificates"("certificate_id") ON DELETE no action ON UPDATE no action
);--> statement-breakpoint
CREATE INDEX "idx_cert_req_status" ON "certificate_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_cert_req_intake" ON "certificate_requests" USING btree ("intake_id");--> statement-breakpoint
CREATE INDEX "idx_cert_req_created_by" ON "certificate_requests" USING btree ("created_by");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_cert_req_item_unique" ON "certificate_request_items" USING btree ("request_id","enrollment_id");--> statement-breakpoint
CREATE INDEX "idx_cert_req_item_enrollment" ON "certificate_request_items" USING btree ("enrollment_id");--> statement-breakpoint
CREATE INDEX "idx_cert_req_item_request" ON "certificate_request_items" USING btree ("request_id");
