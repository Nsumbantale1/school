CREATE TYPE "public"."audit_action" AS ENUM('create', 'update', 'delete');--> statement-breakpoint
CREATE TYPE "public"."enrollment_status" AS ENUM('enrolled', 'in_progress', 'completed', 'failed', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."gender_type" AS ENUM('male', 'female');--> statement-breakpoint
CREATE TYPE "public"."grade" AS ENUM('A', 'B', 'C', 'D', 'F');--> statement-breakpoint
CREATE TYPE "public"."personnel_category" AS ENUM('officer', 'enlisted');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'instructor', 'viewer');--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(50) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"name" varchar(100) NOT NULL,
	"role" "user_role" DEFAULT 'viewer' NOT NULL,
	"assigned_course_id" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "students" (
	"army_number" varchar(20) PRIMARY KEY NOT NULL,
	"full_name" varchar(100) NOT NULL,
	"rank" varchar(30) NOT NULL,
	"gender" "gender_type" NOT NULL,
	"date_of_birth" date,
	"unit" varchar(100),
	"phone" varchar(20),
	"email" varchar(100),
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"course_id" serial PRIMARY KEY NOT NULL,
	"course_code" varchar(20) NOT NULL,
	"course_name" varchar(150) NOT NULL,
	"description" text,
	"duration_weeks" smallint NOT NULL,
	"passing_mark" smallint DEFAULT 40 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "courses_course_code_unique" UNIQUE("course_code")
);
--> statement-breakpoint
CREATE TABLE "course_intakes" (
	"intake_id" serial PRIMARY KEY NOT NULL,
	"course_id" integer NOT NULL,
	"intake_number" varchar(30) NOT NULL,
	"year" smallint NOT NULL,
	"commander_name" varchar(100),
	"coordinator_name" varchar(100),
	"start_date" date NOT NULL,
	"end_date" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idx_intake_unique" UNIQUE("course_id","intake_number")
);
--> statement-breakpoint
CREATE TABLE "course_prerequisites" (
	"id" serial PRIMARY KEY NOT NULL,
	"course_id" integer NOT NULL,
	"prerequisite_course_id" integer NOT NULL,
	"is_optional" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idx_prereq_unique" UNIQUE("course_id","prerequisite_course_id")
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"enrollment_id" serial PRIMARY KEY NOT NULL,
	"student_army_number" varchar(20) NOT NULL,
	"intake_id" integer NOT NULL,
	"status" "enrollment_status" DEFAULT 'enrolled' NOT NULL,
	"total_marks" numeric(8, 2),
	"average_marks" numeric(6, 2),
	"grade" "grade",
	"position" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "results" (
	"result_id" serial PRIMARY KEY NOT NULL,
	"enrollment_id" integer NOT NULL,
	"subject_name" varchar(150) NOT NULL,
	"marks_obtained" numeric(6, 2) NOT NULL,
	"max_marks" numeric(6, 2) DEFAULT '100' NOT NULL,
	"grade" "grade",
	"remarks" text,
	"entered_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idx_result_unique" UNIQUE("enrollment_id","subject_name")
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"document_id" serial PRIMARY KEY NOT NULL,
	"student_army_number" varchar(20),
	"enrollment_id" integer,
	"file_name" varchar(255) NOT NULL,
	"file_type" varchar(50) NOT NULL,
	"file_size" integer NOT NULL,
	"file_path" varchar(500) NOT NULL,
	"description" text,
	"uploaded_by" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"log_id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"user_name" varchar(100),
	"action" "audit_action" NOT NULL,
	"table_name" varchar(50) NOT NULL,
	"record_id" varchar(50) NOT NULL,
	"old_values" jsonb,
	"new_values" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_logs" (
	"log_id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"username" varchar(50) NOT NULL,
	"success" boolean NOT NULL,
	"failure_reason" varchar(100),
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_assigned_course_id_courses_course_id_fk" FOREIGN KEY ("assigned_course_id") REFERENCES "public"."courses"("course_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_intakes" ADD CONSTRAINT "course_intakes_course_id_courses_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("course_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_prerequisites" ADD CONSTRAINT "course_prerequisites_course_id_courses_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("course_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_prerequisites" ADD CONSTRAINT "course_prerequisites_prerequisite_course_id_courses_course_id_fk" FOREIGN KEY ("prerequisite_course_id") REFERENCES "public"."courses"("course_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_student_army_number_students_army_number_fk" FOREIGN KEY ("student_army_number") REFERENCES "public"."students"("army_number") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_intake_id_course_intakes_intake_id_fk" FOREIGN KEY ("intake_id") REFERENCES "public"."course_intakes"("intake_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "results" ADD CONSTRAINT "results_enrollment_id_enrollments_enrollment_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("enrollment_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "results" ADD CONSTRAINT "results_entered_by_users_id_fk" FOREIGN KEY ("entered_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_student_army_number_students_army_number_fk" FOREIGN KEY ("student_army_number") REFERENCES "public"."students"("army_number") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_enrollment_id_enrollments_enrollment_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("enrollment_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "login_logs" ADD CONSTRAINT "login_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_users_username" ON "users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "idx_users_role" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "idx_users_assigned_course" ON "users" USING btree ("assigned_course_id");--> statement-breakpoint
CREATE INDEX "idx_students_name" ON "students" USING btree ("full_name");--> statement-breakpoint
CREATE INDEX "idx_students_rank" ON "students" USING btree ("rank");--> statement-breakpoint
CREATE INDEX "idx_students_unit" ON "students" USING btree ("unit");--> statement-breakpoint
CREATE INDEX "idx_students_active" ON "students" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_courses_code" ON "courses" USING btree ("course_code");--> statement-breakpoint
CREATE INDEX "idx_courses_name" ON "courses" USING btree ("course_name");--> statement-breakpoint
CREATE INDEX "idx_courses_active" ON "courses" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_intakes_course" ON "course_intakes" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "idx_intakes_year" ON "course_intakes" USING btree ("year");--> statement-breakpoint
CREATE INDEX "idx_intakes_dates" ON "course_intakes" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "idx_prereq_course" ON "course_prerequisites" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "idx_prereq_prereq" ON "course_prerequisites" USING btree ("prerequisite_course_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_enrollment_unique" ON "enrollments" USING btree ("student_army_number","intake_id");--> statement-breakpoint
CREATE INDEX "idx_enroll_student" ON "enrollments" USING btree ("student_army_number");--> statement-breakpoint
CREATE INDEX "idx_enroll_intake" ON "enrollments" USING btree ("intake_id");--> statement-breakpoint
CREATE INDEX "idx_enroll_status" ON "enrollments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_enroll_grade" ON "enrollments" USING btree ("grade");--> statement-breakpoint
CREATE INDEX "idx_enroll_position" ON "enrollments" USING btree ("position");--> statement-breakpoint
CREATE INDEX "idx_result_enrollment" ON "results" USING btree ("enrollment_id");--> statement-breakpoint
CREATE INDEX "idx_result_subject" ON "results" USING btree ("subject_name");--> statement-breakpoint
CREATE INDEX "idx_result_grade" ON "results" USING btree ("grade");--> statement-breakpoint
CREATE INDEX "idx_result_entered_by" ON "results" USING btree ("entered_by");--> statement-breakpoint
CREATE INDEX "idx_doc_student" ON "documents" USING btree ("student_army_number");--> statement-breakpoint
CREATE INDEX "idx_doc_enrollment" ON "documents" USING btree ("enrollment_id");--> statement-breakpoint
CREATE INDEX "idx_doc_uploaded_by" ON "documents" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "idx_doc_file_type" ON "documents" USING btree ("file_type");--> statement-breakpoint
CREATE INDEX "idx_audit_user" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_audit_action" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_audit_table" ON "audit_logs" USING btree ("table_name");--> statement-breakpoint
CREATE INDEX "idx_audit_record" ON "audit_logs" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "idx_audit_created" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_login_user" ON "login_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_login_username" ON "login_logs" USING btree ("username");--> statement-breakpoint
CREATE INDEX "idx_login_success" ON "login_logs" USING btree ("success");--> statement-breakpoint
CREATE INDEX "idx_login_created" ON "login_logs" USING btree ("created_at");