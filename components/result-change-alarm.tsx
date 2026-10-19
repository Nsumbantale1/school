import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import type { UserRole } from "@/lib/auth/types";

type Alarm = {
  id: number;
  requestNumber: string;
  courseCode: string;
  intakeNumber: string;
  requestedByName: string;
};

export function ResultChangeAlarm({ role, alarms }: { role: UserRole; alarms: Alarm[] }) {
  if (alarms.length === 0) return null;

  const stage =
    role === "commandant"
      ? "The Chief Instructor has checked it. Your approval applies the change."
      : "Check it, then approve to pass it to the Commandant.";

  return (
    <div className="mb-4 space-y-2">
      {alarms.map((alarm) => (
        <Link
          key={alarm.id}
          href={`/results/changes/${alarm.id}`}
          className="flex items-start gap-3 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-rose-950 shadow-sm transition hover:brightness-95"
        >
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
          <span>
            <span className="block text-sm font-semibold">
              Result change waiting for you ({alarm.requestNumber})
            </span>
            <span className="mt-0.5 block text-sm">
              {alarm.requestedByName} wants to change recorded marks for {alarm.courseCode} ·{" "}
              {alarm.intakeNumber}. {stage}
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}
