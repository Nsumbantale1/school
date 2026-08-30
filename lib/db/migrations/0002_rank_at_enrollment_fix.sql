ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "rank_at_enrollment" varchar(30);--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "unit_at_enrollment" varchar(100);--> statement-breakpoint
UPDATE "enrollments" e
SET
  "rank_at_enrollment" = COALESCE(e."rank_at_enrollment", s."rank"),
  "unit_at_enrollment" = COALESCE(e."unit_at_enrollment", s."unit")
FROM "students" s
WHERE e."student_army_number" = s."army_number";--> statement-breakpoint
UPDATE "enrollments"
SET "rank_at_enrollment" = 'Unknown'
WHERE "rank_at_enrollment" IS NULL;--> statement-breakpoint
ALTER TABLE "enrollments" ALTER COLUMN "rank_at_enrollment" SET NOT NULL;
