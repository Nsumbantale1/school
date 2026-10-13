import { sql } from "drizzle-orm";
import { db } from "./index";

let ready: Promise<void> | null = null;

/** Create the progress-chart table on the database this server is using. */
export function ensureProgressTestsTable(): Promise<void> {
  if (!ready) {
    ready = db
      .execute(sql`
        CREATE TABLE IF NOT EXISTS progress_tests (
          id serial PRIMARY KEY,
          enrollment_id integer NOT NULL REFERENCES enrollments(enrollment_id) ON DELETE CASCADE,
          kind varchar(16) NOT NULL,
          period smallint NOT NULL,
          marks numeric(6, 2) NOT NULL,
          updated_by integer REFERENCES users(id),
          updated_at timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT idx_progress_test_unique UNIQUE (enrollment_id, kind, period)
        )
      `)
      .then(() =>
        db.execute(sql`
          CREATE INDEX IF NOT EXISTS idx_progress_test_enrollment
          ON progress_tests (enrollment_id)
        `)
      )
      .then(() => undefined)
      .catch((error) => {
        ready = null;
        throw error;
      });
  }
  return ready;
}
