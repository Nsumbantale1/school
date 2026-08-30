import { redirect } from "next/navigation";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { GlobalSearch } from "@/components/global-search";
import { BackupFridayReminder } from "@/components/backup-friday-reminder";
import { getSessionUser } from "@/lib/auth";
import { getLastBackupDate } from "@/lib/utils/backup-tracker";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const lastBackupAt =
    user.role === "admin" ? await getLastBackupDate() : null;

  return (
    <SidebarProvider>
      <AppSidebar user={{ name: user.name, role: user.role }} />
      <SidebarInset className="h-svh overflow-hidden md:h-[calc(100svh-1rem)]">
        <header className="flex h-14 shrink-0 items-center gap-3 rounded-t-xl border-b bg-background px-4">
          <SidebarTrigger className="-ml-1 size-8" />
          <span className="text-sm font-semibold">School of Field Artillery</span>
          <div className="ml-auto">
            <GlobalSearch />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6">
          {user.role === "admin" && (
            <BackupFridayReminder
              lastBackupAt={lastBackupAt?.toISOString() ?? null}
            />
          )}
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
