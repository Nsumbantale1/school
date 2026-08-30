DO $$ BEGIN
  CREATE TYPE "public"."notice_category" AS ENUM('general', 'schedule', 'safety', 'exam', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."notice_priority" AS ENUM('normal', 'important', 'urgent');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."exercise_type" AS ENUM('theory', 'practical', 'firing', 'pt', 'field', 'assessment', 'drill', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "course_notices" (
  "id" serial PRIMARY KEY NOT NULL,
  "course_id" integer NOT NULL REFERENCES "courses"("course_id") ON DELETE CASCADE,
  "title" varchar(200) NOT NULL,
  "body" text NOT NULL,
  "category" "notice_category" DEFAULT 'general' NOT NULL,
  "priority" "notice_priority" DEFAULT 'normal' NOT NULL,
  "attachment_path" varchar(500),
  "attachment_name" varchar(255),
  "is_pinned" boolean DEFAULT false NOT NULL,
  "expires_at" timestamp with time zone,
  "created_by" integer REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_course_notices_course" ON "course_notices" ("course_id");
CREATE INDEX IF NOT EXISTS "idx_course_notices_pinned" ON "course_notices" ("is_pinned");
CREATE INDEX IF NOT EXISTS "idx_course_notices_created" ON "course_notices" ("created_at");

CREATE TABLE IF NOT EXISTS "course_exercises" (
  "id" serial PRIMARY KEY NOT NULL,
  "course_id" integer NOT NULL REFERENCES "courses"("course_id") ON DELETE CASCADE,
  "week_number" smallint NOT NULL,
  "title" varchar(200) NOT NULL,
  "description" text,
  "exercise_type" "exercise_type" DEFAULT 'other' NOT NULL,
  "location" varchar(150),
  "duration" varchar(80),
  "sort_order" smallint DEFAULT 0 NOT NULL,
  "created_by" integer REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_course_exercises_course" ON "course_exercises" ("course_id");
CREATE INDEX IF NOT EXISTS "idx_course_exercises_week" ON "course_exercises" ("week_number");
