export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { officialSignatures } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { BackButton } from "@/components/back-button";
import { requireRole } from "@/lib/auth/guards";
import { SignatureManager } from "./_components/signature-manager";

async function getActiveOfficial(role: "chief_instructor" | "commandant") {
  const [row] = await db
    .select()
    .from(officialSignatures)
    .where(
      and(
        eq(officialSignatures.role, role),
        eq(officialSignatures.isActive, true)
      )
    )
    .orderBy(desc(officialSignatures.createdAt))
    .limit(1);
  return row ?? null;
}

export default async function CertificateSignaturesPage() {
  await requireRole(["admin"]);

  const [chiefInstructor, commandant] = await Promise.all([
    getActiveOfficial("chief_instructor"),
    getActiveOfficial("commandant"),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Certificate Signatures"
        description="Upload scanned signatures for Chief Instructor and Commandant. When officials change, upload a new signature — old certificates keep the signatures issued at the time."
      >
        <BackButton fallbackHref="/dashboard" />
      </PageHeader>

      <SignatureManager
        chiefInstructor={chiefInstructor}
        commandant={commandant}
      />
    </div>
  );
}
