ALTER TYPE "enrollment_status" ADD VALUE IF NOT EXISTS 'incomplete';--> statement-breakpoint
ALTER TYPE "enrollment_status" ADD VALUE IF NOT EXISTS 'indiscipline';--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "ceased_at" timestamp with time zone;
