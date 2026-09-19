export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { Barlow_Condensed } from "next/font/google";
import { desc, eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { presentations, users } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { BackButton } from "@/components/back-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getPresentationCategory,
  isPresentationCategory,
} from "@/lib/utils/presentations";
import { PresentationUploadForm } from "../_components/upload-form";
import { PresentationsList } from "../_components/presentations-list";

const display = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-course-display",
});

export default async function PresentationCategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category: raw } = await params;
  if (!isPresentationCategory(raw)) notFound();
  const meta = getPresentationCategory(raw)!;
  const user = await getSessionUser();
  const canManage =
    user?.role === "admin" || user?.role === "instructor";

  const rows = await db
    .select({
      id: presentations.id,
      title: presentations.title,
      description: presentations.description,
      presenterName: presentations.presenterName,
      audience: presentations.audience,
      venue: presentations.venue,
      presentedAt: presentations.presentedAt,
      fileName: presentations.fileName,
      fileSize: presentations.fileSize,
      mimeType: presentations.mimeType,
      createdAt: presentations.createdAt,
      uploaderName: users.name,
    })
    .from(presentations)
    .leftJoin(users, eq(presentations.uploadedBy, users.id))
    .where(
      and(
        eq(presentations.category, raw),
        eq(presentations.isActive, true)
      )
    )
    .orderBy(desc(presentations.presentedAt), desc(presentations.createdAt));

  return (
    <div className={`space-y-6 ${display.variable}`}>
      <div
        className={`rounded-2xl border border-black/5 bg-gradient-to-r ${meta.accent} p-px`}
      >
        <div className="rounded-[15px] bg-[linear-gradient(165deg,rgba(255,255,255,0.92),rgba(248,245,237,0.96))] px-5 py-5 dark:bg-card sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#5c6b5c]">
                {meta.subtitle} · Presentations
              </p>
              <PageHeader
                title={meta.title}
                description={meta.description}
              />
              <p className="mt-1 text-sm text-muted-foreground">
                {rows.length} file{rows.length === 1 ? "" : "s"}
              </p>
            </div>
            <BackButton fallbackHref="/presentations" />
          </div>
        </div>
      </div>

      {canManage && (
        <Card className="border-[#1a5c2e]/20 bg-[#fbf9f4]/70 dark:bg-card">
          <CardHeader>
            <CardTitle className="text-base">Upload presentation</CardTitle>
            <CardDescription>
              Archive PDF or PowerPoint for this category. Files are stored
              privately and downloaded with login.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PresentationUploadForm defaultCategory={raw} />
          </CardContent>
        </Card>
      )}

      <PresentationsList
        canManage={!!canManage}
        accentClass={meta.accent}
        items={rows.map((r) => ({
          id: r.id,
          title: r.title,
          description: r.description,
          presenterName: r.presenterName,
          audience: r.audience,
          venue: r.venue,
          presentedAt: r.presentedAt,
          fileName: r.fileName,
          fileSize: r.fileSize,
          mimeType: r.mimeType,
          createdAt: r.createdAt.toISOString(),
        }))}
      />

      {!canManage && (
        <p className="text-center text-xs text-muted-foreground">
          Only admin / instructor can upload.{" "}
          <Link href="/presentations" className="underline">
            Back to categories
          </Link>
        </p>
      )}
    </div>
  );
}
