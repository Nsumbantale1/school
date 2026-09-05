"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Pin,
  Paperclip,
  Trash2,
  AlertTriangle,
  Info,
  Calendar,
  Shield,
  FileText,
  Download,
  Loader2,
} from "lucide-react";
import { deleteCourseNotice } from "../../actions";
import { cn } from "@/lib/utils";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

interface NoticeRow {
  id: number;
  title: string;
  body: string;
  category: string;
  priority: string;
  attachmentPath: string | null;
  attachmentName: string | null;
  isPinned: boolean;
  expiresAt: string | null;
  createdAt: string;
  authorName: string | null;
  subjectId?: number;
  subjectName?: string | null;
}

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  general: Info,
  schedule: Calendar,
  safety: Shield,
  exam: FileText,
  admin: FileText,
};

const PRIORITY_STYLES: Record<string, string> = {
  normal: "border-border",
  important: "border-amber-300 bg-amber-50/50 dark:bg-amber-950/20",
  urgent: "border-red-300 bg-red-50/50 dark:bg-red-950/20",
};

export function NoticesList({
  notices,
  courseId,
  subjectId,
  canManage,
}: {
  notices: NoticeRow[];
  courseId: number;
  subjectId?: number;
  canManage: boolean;
}) {
  const [deleting, setDeleting] = useState<number | null>(null);
  const [downloading, setDownloading] = useState<number | null>(null);

  async function handleDelete(id: number, noticeSubjectId?: number) {
    const sid = noticeSubjectId ?? subjectId;
    if (!sid) {
      toast.error("Missing subject for this notice.");
      return;
    }
    if (!confirm("Delete this notice?")) return;
    setDeleting(id);
    const result = await deleteCourseNotice(id, courseId, sid);
    setDeleting(null);
    if (result.success) toast.success("Notice deleted.");
    else toast.error("Failed to delete notice.");
  }

  async function handleDownloadPdf(noticeId: number) {
    setDownloading(noticeId);
    try {
      const response = await fetch(
        `/api/course-notices/notices/${noticeId}/download`
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Download failed.");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition");
      const match = disposition?.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `notice-${noticeId}.pdf`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to download notice."
      );
    } finally {
      setDownloading(null);
    }
  }

  if (notices.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No notices yet. Publish the first notice for this subject above.
      </p>
    );
  }

  const now = new Date();

  return (
    <div className="space-y-3">
      {notices.map((n) => {
        const Icon = CATEGORY_ICONS[n.category] ?? Info;
        const expired = n.expiresAt && new Date(n.expiresAt) < now;

        return (
          <Card
            key={n.id}
            className={cn(
              "border-l-4",
              PRIORITY_STYLES[n.priority] ?? PRIORITY_STYLES.normal,
              expired && "opacity-60"
            )}
          >
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {n.isPinned && (
                      <Pin className="h-3.5 w-3.5 text-primary shrink-0" />
                    )}
                    {n.priority === "urgent" && (
                      <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                    )}
                    <h3 className="font-semibold">{n.title}</h3>
                    {n.subjectName && (
                      <Badge variant="secondary" className="text-xs">
                        {n.subjectName}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs capitalize gap-1">
                      <Icon className="h-3 w-3" />
                      {n.category}
                    </Badge>
                    {n.priority !== "normal" && (
                      <Badge
                        variant={n.priority === "urgent" ? "destructive" : "secondary"}
                        className="text-xs capitalize"
                      >
                        {n.priority}
                      </Badge>
                    )}
                    {expired && (
                      <Badge variant="outline" className="text-xs">
                        Expired
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{n.body}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5"
                      disabled={downloading === n.id}
                      onClick={() => handleDownloadPdf(n.id)}
                    >
                      {downloading === n.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="h-3.5 w-3.5" />
                      )}
                      Download PDF
                    </Button>
                    {n.attachmentPath && (
                      <a
                        href={`/api/course-notices/notices/${n.id}/attachment`}
                        className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
                      >
                        <Paperclip className="h-3.5 w-3.5" />
                        {n.attachmentName ?? "Download file"}
                      </a>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {n.authorName ? `${n.authorName} · ` : ""}
                    {formatDateTime(n.createdAt)}
                    {n.expiresAt && ` · Expires ${formatDate(n.expiresAt)}`}
                  </p>
                </div>
                {canManage && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-destructive hover:text-destructive"
                    disabled={deleting === n.id}
                    onClick={() => handleDelete(n.id, n.subjectId)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
