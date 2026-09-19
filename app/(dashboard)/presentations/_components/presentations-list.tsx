"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Download,
  Trash2,
  Search,
  Calendar,
  MapPin,
  User,
  Users,
  FileType,
  Loader2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/lib/utils/presentations";
import { deletePresentation } from "../actions";

export type PresentationListItem = {
  id: number;
  title: string;
  description: string | null;
  presenterName: string | null;
  audience: string | null;
  venue: string | null;
  presentedAt: string | null;
  fileName: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
};

function fileKind(mime: string, name: string): string {
  if (mime.includes("pdf") || name.toLowerCase().endsWith(".pdf")) return "PDF";
  if (mime.includes("presentation") || /\.pptx?$/i.test(name)) return "PPT";
  if (mime.includes("word") || /\.docx?$/i.test(name)) return "DOC";
  return "FILE";
}

export function PresentationsList({
  items,
  canManage,
  accentClass,
}: {
  items: PresentationListItem[];
  canManage: boolean;
  accentClass: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((p) =>
      [p.title, p.presenterName, p.audience, p.venue, p.description, p.fileName]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [items, query]);

  async function handleDelete(id: number) {
    if (!confirm("Delete this presentation permanently?")) return;
    setDeletingId(id);
    const result = await deletePresentation(id);
    setDeletingId(null);
    if (!result.success) {
      toast.error(result.error ?? "Delete failed.");
      return;
    }
    toast.success("Presentation removed.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search title, presenter, venue…"
          className="h-9 border-[#d5d0c4] bg-[#fbf9f4] pl-8 text-sm dark:border-border dark:bg-background"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#cfc8b8] px-6 py-14 text-center text-sm text-muted-foreground dark:border-border">
          No presentations in this archive yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((p) => (
            <li
              key={p.id}
              className={cn(
                "group relative overflow-hidden rounded-xl border border-[#ddd6c6]",
                "bg-[linear-gradient(165deg,rgba(255,255,255,0.55),transparent_40%),linear-gradient(180deg,#fbf8f1,#f0ebe0)]",
                "shadow-[0_8px_22px_-16px_rgba(0,0,0,0.35)] transition-all duration-300",
                "hover:-translate-y-0.5 hover:border-[#1a5c2e]/30",
                "dark:border-border dark:bg-card"
              )}
            >
              <div className={cn("h-1 w-full bg-gradient-to-r", accentClass)} />
              <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-md bg-black/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#3d4a3d] dark:bg-white/10 dark:text-muted-foreground">
                      <FileType className="h-3 w-3" />
                      {fileKind(p.mimeType, p.fileName)}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {formatFileSize(p.fileSize)}
                    </span>
                  </div>
                  <h3
                    className="text-lg font-semibold leading-snug tracking-wide text-[#142016] dark:text-[#e8f0e8]"
                    style={{
                      fontFamily:
                        "var(--font-course-display), ui-sans-serif, system-ui",
                    }}
                  >
                    {p.title}
                  </h3>
                  {p.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {p.description}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#5c6b5c] dark:text-muted-foreground">
                    {p.presentedAt && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(p.presentedAt).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    )}
                    {p.presenterName && (
                      <span className="inline-flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {p.presenterName}
                      </span>
                    )}
                    {p.audience && (
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {p.audience}
                      </span>
                    )}
                    {p.venue && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {p.venue}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {p.fileName}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button asChild size="sm" variant="default">
                    <a href={`/api/presentations/${p.id}/download`}>
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      Download
                    </a>
                  </Button>
                  {canManage && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={deletingId === p.id}
                      onClick={() => handleDelete(p.id)}
                    >
                      {deletingId === p.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
