export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { BackButton } from "@/components/back-button";
import { ComparativeView } from "./_components/comparative-view";
import {
  getComparison,
  getComparisonOptions,
  type ComparisonMode,
} from "@/lib/utils/comparative-analytics";

interface PageProps {
  searchParams: Promise<{
    mode?: string;
    a?: string;
    b?: string;
  }>;
}

function isValidMode(value: string | undefined): value is ComparisonMode {
  return value === "intakes" || value === "courses" || value === "years";
}

export default async function ComparativeAnalyticsPage({
  searchParams,
}: PageProps) {
  const raw = await searchParams;
  const mode: ComparisonMode = isValidMode(raw.mode) ? raw.mode : "intakes";
  const idA = raw.a ?? "";
  const idB = raw.b ?? "";

  const options = await getComparisonOptions();
  const comparison =
    idA && idB && idA !== idB
      ? await getComparison(mode, idA, idB)
      : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Comparative Analytics"
        description="Compare two intakes, courses, or years side by side — pass rates, grades, and enrollment outcomes."
      >
        <BackButton fallbackHref="/analytics" />
      </PageHeader>

      <Suspense fallback={<div className="text-muted-foreground">Loading…</div>}>
        <ComparativeView
          courses={options.courses}
          intakes={options.intakes}
          years={options.years}
          comparison={comparison}
          mode={mode}
          idA={idA}
          idB={idB}
        />
      </Suspense>
    </div>
  );
}
