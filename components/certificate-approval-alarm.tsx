import Link from "next/link";
import { BellRing } from "lucide-react";
import type { CertificateAlarm } from "@/lib/utils/certificate-requests";

const COPY: Record<
  CertificateAlarm["tone"],
  { title: string; detail: (alarm: CertificateAlarm) => string; className: string }
> = {
  waiting: {
    title: "Certificate approval is waiting for you",
    detail: (alarm) =>
      `${alarm.certificateCount} certificate(s) for ${alarm.courseLabel} (${alarm.requestNumber}) need your approval now.`,
    className: "border-amber-300 bg-amber-50 text-amber-950",
  },
  ci_approved: {
    title: "Chief Instructor has approved",
    detail: (alarm) =>
      `${alarm.certificateCount} certificate(s) for ${alarm.courseLabel} (${alarm.requestNumber}) are waiting for the Commandant.`,
    className: "border-sky-300 bg-sky-50 text-sky-950",
  },
  ready: {
    title: "Ready to print",
    detail: (alarm) =>
      `Commandant has approved. ${alarm.certificateCount} certificate(s) for ${alarm.courseLabel} (${alarm.requestNumber}) are ready.`,
    className: "border-emerald-300 bg-emerald-50 text-emerald-950",
  },
};

export function CertificateApprovalAlarm({ alarms }: { alarms: CertificateAlarm[] }) {
  if (alarms.length === 0) return null;

  return (
    <div className="mb-4 space-y-2">
      {alarms.map((alarm) => {
        const copy = COPY[alarm.tone];
        return (
          <Link
            key={alarm.id}
            href={alarm.href}
            className={`flex items-start gap-3 rounded-lg border px-4 py-3 shadow-sm transition hover:brightness-95 ${copy.className}`}
          >
            <BellRing className="mt-0.5 h-5 w-5 shrink-0" />
            <span>
              <span className="block text-sm font-semibold">{copy.title}</span>
              <span className="mt-0.5 block text-sm">{copy.detail(alarm)}</span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
