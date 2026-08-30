export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { AnalyticsDashboard } from "./_components/analytics-dashboard";
import { getAnalyticsDashboard } from "@/lib/utils/analytics-data";

interface PageProps {
  searchParams: Promise<{ year?: string; course?: string }>;
}

export default async function AnalyticsPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const filters = {
    year: raw.year ? parseInt(raw.year) : undefined,
    courseId: raw.course ? parseInt(raw.course) : undefined,
  };

  const data = await getAnalyticsDashboard(filters);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Professional training intelligence — KPIs, trends, course & subject analysis with year and course filters."
      />

      <Suspense fallback={<div className="text-muted-foreground">Loading analytics…</div>}>
        <AnalyticsDashboard data={data} />
      </Suspense>
    </div>
  );
}
