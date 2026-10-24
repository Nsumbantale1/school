import { sql } from "drizzle-orm";
import { db } from "./index";

let ready: Promise<void> | null = null;

/** Chief Instructor grants a coordinator permission to change saved weekly marks. */
export function ensureProgressAuthoritiesTable(): Promise<void> {
  if (!ready) {
    ready = db
      .execute(sql`
        CREATE TABLE IF NOT EXISTS progress_edit_authorities (
          id serial PRIMARY KEY,
          intake_id integer NOT NULL REFERENCES course_intakes(intake_id) ON DELETE CASCADE,
          requested_by integer NOT NULL REFERENCES users(id),
          reason text NOT NULL,
          status varchar(20) NOT NULL DEFAULT 'pending',
          decided_by integer REFERENCES users(id),
          decided_at timestamptz,
          decision_note text,
          created_at timestamptz NOT NULL DEFAULT now(),
          closed_at timestamptz
        )
      `)
      .then(() =>
        db.execute(sql`
          CREATE INDEX IF NOT EXISTS idx_progress_auth_intake
          ON progress_edit_authorities (intake_id)
        `)
      )
      .then(() =>
        db.execute(sql`
          CREATE INDEX IF NOT EXISTS idx_progress_auth_status
          ON progress_edit_authorities (status)
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
