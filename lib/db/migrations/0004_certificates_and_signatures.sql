CREATE TYPE "public"."official_role" AS ENUM('chief_instructor', 'commandant');--> statement-breakpoint
CREATE TABLE "official_signatures" (
	"id" serial PRIMARY KEY NOT NULL,
	"role" "official_role" NOT NULL,
	"full_name" varchar(100),
	"rank_title" varchar(50),
	"signature_image_path" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"effective_from" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "certificates" (
	"certificate_id" serial PRIMARY KEY NOT NULL,
	"enrollment_id" integer NOT NULL,
	"certificate_number" varchar(60) NOT NULL,
	"chief_instructor_name" varchar(100),
	"chief_instructor_rank" varchar(50),
	"chief_instructor_signature_path" varchar(255),
	"commandant_name" varchar(100),
	"commandant_rank" varchar(50),
	"commandant_signature_path" varchar(255),
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"issued_by" integer,
	CONSTRAINT "certificates_certificate_number_unique" UNIQUE("certificate_number"),
	CONSTRAINT "certificates_enrollment_id_enrollments_enrollment_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("enrollment_id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "certificates_issued_by_users_id_fk" FOREIGN KEY ("issued_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action
);--> statement-breakpoint
CREATE INDEX "idx_official_role" ON "official_signatures" USING btree ("role");--> statement-breakpoint
CREATE INDEX "idx_official_active" ON "official_signatures" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_certificate_enrollment" ON "certificates" USING btree ("enrollment_id");--> statement-breakpoint
CREATE INDEX "idx_certificate_number" ON "certificates" USING btree ("certificate_number");
