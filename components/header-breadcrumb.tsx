"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

const LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  students: "Students",
  courses: "Courses",
  "course-notices": "Course Notices",
  weekly: "Weekly & Monthly Test",
  course: "Course",
  presentations: "Presentations",
  intakes: "Intakes",
  enrollments: "Enrollments",
  results: "Results",
  certificates: "Certificates",
  reports: "Reports",
  analytics: "Analytics",
  comparative: "Comparative",
  users: "Users",
  "audit-logs": "Activity Logs",
  documents: "Documents",
  settings: "Settings",
  signatures: "Signatures",
  backup: "Backup",
  notifications: "Notifications",
  new: "New",
  edit: "Edit",
};

function labelFor(segment: string): string {
  const decoded = decodeURIComponent(segment);
  return LABELS[decoded] ?? decoded.replace(/-/g, " ");
}

export function HeaderBreadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean).slice(0, 3);

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
      <Link
        href="/dashboard"
        className="hidden shrink-0 font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline"
      >
        SOFA
      </Link>
      {segments.map((segment, i) => {
        const href = "/" + segments.slice(0, i + 1).join("/");
        const last = i === segments.length - 1;
        return (
          <span key={href} className="flex min-w-0 items-center gap-1.5">
            <ChevronRight className="hidden size-3.5 shrink-0 text-muted-foreground/60 sm:block" />
            {last ? (
              <span className="truncate font-semibold capitalize">{labelFor(segment)}</span>
            ) : (
              <Link
                href={href}
                className="truncate capitalize text-muted-foreground transition-colors hover:text-foreground"
              >
                {labelFor(segment)}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
