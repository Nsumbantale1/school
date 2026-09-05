import { Loader2 } from "lucide-react";

export default function CourseNoticesLoading() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin" />
      <p className="text-sm">Loading course notices…</p>
    </div>
  );
}
