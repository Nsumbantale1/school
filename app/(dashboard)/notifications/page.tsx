export const dynamic = "force-dynamic";

import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { appNotifications } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { BackButton } from "@/components/back-button";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { markNotificationsReadAll } from "./actions";

export default async function NotificationsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const rows = await db
    .select()
    .from(appNotifications)
    .where(eq(appNotifications.userId, user.userId))
    .orderBy(desc(appNotifications.createdAt))
    .limit(50);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Certificate approvals and system alerts for your account"
      >
        <div className="flex gap-2">
          <BackButton fallbackHref="/dashboard" />
          <form
            action={async () => {
              "use server";
              await markNotificationsReadAll();
            }}
          >
            <Button type="submit" variant="outline" size="sm">
              Mark all read
            </Button>
          </form>
        </div>
      </PageHeader>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No notifications yet.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {rows.map((n) => (
            <li key={n.id}>
              <Card className={n.isRead ? "opacity-70" : "border-primary/30"}>
                <CardContent className="space-y-1 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-medium">{n.title}</p>
                    <span className="text-[11px] text-muted-foreground">
                      {n.createdAt.toLocaleString("en-GB")}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{n.body}</p>
                  {n.href && (
                    <Link
                      href={n.href}
                      className="inline-block text-sm text-primary underline"
                    >
                      Open
                    </Link>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
