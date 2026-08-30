DELETE FROM "course_notices";

ALTER TABLE "course_notices"
  ADD COLUMN IF NOT EXISTS "subject_id" integer NOT NULL
  REFERENCES "course_subjects"("subject_id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "idx_course_notices_subject" ON "course_notices" ("subject_id");
