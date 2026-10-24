import { redirect } from "next/navigation";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { GlobalSearch } from "@/components/global-search";
import { BackupFridayReminder } from "@/components/backup-friday-reminder";
import { NotificationsBell } from "@/components/notifications-bell";
import { getSessionUser } from "@/lib/auth";
import { getLastBackupDate } from "@/lib/utils/backup-tracker";
import { getUnreadNotifications } from "@/lib/utils/notify";
import { listCertificateAlarms } from "@/lib/utils/certificate-requests";
import { CertificateApprovalAlarm } from "@/components/certificate-approval-alarm";
import { listResultChangeAlarms } from "@/lib/utils/result-changes";
import { ResultChangeAlarm } from "@/components/result-change-alarm";
import { listPendingProgressAuthorities } from "@/lib/utils/progress-authority";
import { ProgressAuthorityAlarm } from "@/components/progress-authority-alarm";
import { LogoutButton } from "@/components/logout-button";
import { HeaderBreadcrumb } from "@/components/header-breadcrumb";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [lastBackupAt, unread, alarms, resultChangeAlarms, progressAuthorityCount] = await Promise.all([
    user.role === "admin"
      ? getLastBackupDate().catch(() => null)
      : Promise.resolve(null),
    getUnreadNotifications(user.userId, 10).catch((error) => {
      console.warn("Notifications unavailable:", error);
      return [];
    }),
    listCertificateAlarms(user.role).catch((error) => {
      console.warn("Certificate alarms unavailable:", error);
      return [];
    }),
    listResultChangeAlarms(user).catch((error) => {
      console.warn("Result change alarms unavailable:", error);
      return [];
    }),
    user.role === "chief_instructor"
      ? listPendingProgressAuthorities()
          .then((rows) => rows.length)
          .catch((error) => {
            console.warn("Weekly authority unavailable:", error);
            return 0;
          })
      : Promise.resolve(0),
  ]);
  const unreadCount = unread.length;
  const unreadItems = unread.slice(0, 8);

  return (
    <SidebarProvider>
      <AppSidebar user={{ name: user.name, role: user.role }} />
      <SidebarInset className="h-svh overflow-hidden md:h-[calc(100svh-1rem)]">
        <header className="flex h-14 shrink-0 items-center gap-3 rounded-t-xl border-b bg-card/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-card/70">
          <SidebarTrigger className="-ml-1 size-8" />
          <span className="h-5 w-px bg-border" />
          <HeaderBreadcrumb />
          <div className="ml-auto flex items-center gap-1">
            <NotificationsBell
              unreadCount={unreadCount}
              items={unreadItems.map((n) => ({
                id: n.id,
                title: n.title,
                body: n.body,
                href: n.href,
                createdAt: n.createdAt.toISOString(),
              }))}
            />
            <GlobalSearch />
            <LogoutButton />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-8">
          {user.role === "admin" && (
            <BackupFridayReminder
              lastBackupAt={lastBackupAt?.toISOString() ?? null}
            />
          )}
          <ResultChangeAlarm role={user.role} alarms={resultChangeAlarms} />
          <ProgressAuthorityAlarm count={progressAuthorityCount} />
          <CertificateApprovalAlarm alarms={alarms} />
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
