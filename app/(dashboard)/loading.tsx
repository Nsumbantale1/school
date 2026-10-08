export default function DashboardSegmentLoading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Loading">
      <div className="flex items-start gap-3 border-b pb-5">
        <span className="bg-regimental-ribbon-y mt-1.5 h-7 w-1 shrink-0 rounded-full opacity-60" />
        <div className="space-y-2">
          <div className="h-7 w-56 rounded-md bg-muted" />
          <div className="h-4 w-80 max-w-[60vw] rounded-md bg-muted/70" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl border bg-card" />
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="h-10 border-b bg-muted/60" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b px-4 py-3 last:border-0">
            <div className="size-8 rounded-full bg-muted" />
            <div className="h-4 flex-1 rounded bg-muted/70" />
            <div className="h-4 w-24 rounded bg-muted/70" />
          </div>
        ))}
      </div>
    </div>
  );
}
