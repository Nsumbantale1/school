export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { auditLogs, loginLogs } from "@/lib/db/schema";
import { desc, eq, and, gte, lte, ilike, sql } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { BackButton } from "@/components/back-button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { requireRole } from "@/lib/auth/guards";
import {
  formatLogWhen,
  summarizeAuditEvent,
} from "@/lib/utils/activity-summary";
import { Filter, History, LogIn, Search } from "lucide-react";

interface PageProps {
  searchParams: Promise<{
    tab?: string;
    table?: string;
    action?: string;
    user?: string;
    from?: string;
    to?: string;
    page?: string;
    loginPage?: string;
  }>;
}

const ALL = "__all__";

export default async function ActivityLogsPage({ searchParams }: PageProps) {
  await requireRole(["admin"]);
  const raw = await searchParams;
  const tab = raw.tab === "logins" ? "logins" : "activity";

  const params = {
    table: raw.table && raw.table !== ALL ? raw.table : undefined,
    action: raw.action && raw.action !== ALL ? raw.action : undefined,
    user: raw.user?.trim() || undefined,
    from: raw.from || undefined,
    to: raw.to || undefined,
  };

  const page = raw.page ? parseInt(raw.page) : 1;
  const loginPage = raw.loginPage ? parseInt(raw.loginPage) : 1;
  const pageSize = 40;
  const offset = (page - 1) * pageSize;
  const loginOffset = (loginPage - 1) * pageSize;

  const conditions = [];
  if (params.table) conditions.push(eq(auditLogs.tableName, params.table));
  if (params.action) {
    conditions.push(
      eq(auditLogs.action, params.action as "create" | "update" | "delete")
    );
  }
  if (params.user) {
    conditions.push(ilike(auditLogs.userName, `%${params.user}%`));
  }
  if (params.from) {
    conditions.push(gte(auditLogs.createdAt, new Date(params.from)));
  }
  if (params.to) {
    conditions.push(
      lte(auditLogs.createdAt, new Date(params.to + "T23:59:59"))
    );
  }

  const [logs, tables, loginRows, activityCount, loginCount] = await Promise.all([
    db
      .select()
      .from(auditLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(auditLogs.createdAt))
      .limit(pageSize)
      .offset(offset),
    db
      .selectDistinct({ tableName: auditLogs.tableName })
      .from(auditLogs)
      .orderBy(auditLogs.tableName),
    db
      .select()
      .from(loginLogs)
      .orderBy(desc(loginLogs.createdAt))
      .limit(pageSize)
      .offset(loginOffset),
    db.select({ count: sql<number>`count(*)` }).from(auditLogs),
    db.select({ count: sql<number>`count(*)` }).from(loginLogs),
  ]);

  const actionBadge = (action: string) => {
    switch (action) {
      case "create":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "update":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "delete":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      default:
        return "";
    }
  };

  const filterQuery = new URLSearchParams();
  if (params.table) filterQuery.set("table", params.table);
  if (params.action) filterQuery.set("action", params.action);
  if (params.user) filterQuery.set("user", params.user);
  if (params.from) filterQuery.set("from", params.from);
  if (params.to) filterQuery.set("to", params.to);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity Logs"
        description="See what happened in the system, when it happened, and who did it."
      >
        <BackButton fallbackHref="/dashboard" />
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Data changes</CardDescription>
            <CardTitle className="text-2xl">
              {Number(activityCount[0]?.count ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Login attempts</CardDescription>
            <CardTitle className="text-2xl">
              {Number(loginCount[0]?.count ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          asChild
          variant={tab === "activity" ? "default" : "outline"}
          size="sm"
        >
          <a
            href={`/audit-logs?${new URLSearchParams({
              ...Object.fromEntries(filterQuery),
              tab: "activity",
            })}`}
          >
            <History className="mr-2 h-4 w-4" />
            Activity (what / when / who)
          </a>
        </Button>
        <Button
          asChild
          variant={tab === "logins" ? "default" : "outline"}
          size="sm"
        >
          <a href="/audit-logs?tab=logins">
            <LogIn className="mr-2 h-4 w-4" />
            Login history
          </a>
        </Button>
      </div>

      {tab === "activity" ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4 md:grid-cols-6">
                <input type="hidden" name="tab" value="activity" />
                <div className="space-y-2">
                  <label className="text-sm font-medium">Who (user)</label>
                  <Input
                    name="user"
                    placeholder="e.g. Admin"
                    defaultValue={params.user ?? ""}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Area</label>
                  <Select name="table" defaultValue={params.table ?? ALL}>
                    <SelectTrigger>
                      <SelectValue placeholder="All areas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>All areas</SelectItem>
                      {tables.map((t) => (
                        <SelectItem key={t.tableName} value={t.tableName}>
                          {t.tableName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Action</label>
                  <Select name="action" defaultValue={params.action ?? ALL}>
                    <SelectTrigger>
                      <SelectValue placeholder="All actions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>All actions</SelectItem>
                      <SelectItem value="create">Create</SelectItem>
                      <SelectItem value="update">Update</SelectItem>
                      <SelectItem value="delete">Delete</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">From</label>
                  <Input
                    type="date"
                    name="from"
                    defaultValue={params.from ?? ""}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">To</label>
                  <Input type="date" name="to" defaultValue={params.to ?? ""} />
                </div>
                <div className="flex items-end">
                  <Button type="submit" className="w-full">
                    <Search className="mr-2 h-4 w-4" />
                    Apply
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Recent activity ({logs.length} shown)
              </CardTitle>
              <CardDescription>
                Columns: When · Who · What happened
              </CardDescription>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No activity logs yet. Changes (students, results, notices,
                  backup…) will appear here.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b text-left text-sm text-muted-foreground">
                        <th className="py-3 px-2 font-medium">When</th>
                        <th className="py-3 px-2 font-medium">Who</th>
                        <th className="py-3 px-2 font-medium">Action</th>
                        <th className="py-3 px-2 font-medium">What happened</th>
                        <th className="py-3 px-2 font-medium">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => (
                        <tr key={log.logId} className="border-b align-top">
                          <td className="py-3 px-2 text-sm whitespace-nowrap">
                            {formatLogWhen(log.createdAt)}
                          </td>
                          <td className="py-3 px-2">
                            <div className="font-medium">
                              {log.userName || "System"}
                            </div>
                            {log.ipAddress && (
                              <div className="text-xs text-muted-foreground">
                                IP: {log.ipAddress}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-2">
                            <Badge
                              variant="outline"
                              className={`capitalize ${actionBadge(log.action)}`}
                            >
                              {log.action}
                            </Badge>
                          </td>
                          <td className="py-3 px-2 text-sm">
                            {summarizeAuditEvent(log)}
                          </td>
                          <td className="py-3 px-2">
                            {(log.newValues != null || log.oldValues != null) && (
                              <details className="text-sm">
                                <summary className="cursor-pointer text-muted-foreground">
                                  View data
                                </summary>
                                <div className="mt-2 space-y-2 max-w-md">
                                  {log.oldValues != null && (
                                    <pre className="text-xs bg-red-50 dark:bg-red-950/20 p-2 rounded overflow-x-auto">
                                      {JSON.stringify(log.oldValues, null, 2)}
                                    </pre>
                                  )}
                                  {log.newValues != null && (
                                    <pre className="text-xs bg-green-50 dark:bg-green-950/20 p-2 rounded overflow-x-auto">
                                      {JSON.stringify(log.newValues, null, 2)}
                                    </pre>
                                  )}
                                </div>
                              </details>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {logs.length === pageSize && (
                <div className="flex justify-center mt-4">
                  <Button asChild variant="outline">
                    <a
                      href={`/audit-logs?${new URLSearchParams({
                        tab: "activity",
                        ...Object.fromEntries(filterQuery),
                        page: String(page + 1),
                      })}`}
                    >
                      Load more
                    </a>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Login history</CardTitle>
            <CardDescription>
              Successful and failed sign-ins — who tried to enter the system and
              when
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loginRows.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No login attempts recorded yet. New logins will appear after the
                next sign-in.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left text-sm text-muted-foreground">
                      <th className="py-3 px-2 font-medium">When</th>
                      <th className="py-3 px-2 font-medium">Username</th>
                      <th className="py-3 px-2 font-medium">Result</th>
                      <th className="py-3 px-2 font-medium">Reason</th>
                      <th className="py-3 px-2 font-medium">IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loginRows.map((log) => (
                      <tr key={log.logId} className="border-b">
                        <td className="py-3 px-2 text-sm whitespace-nowrap">
                          {formatLogWhen(log.createdAt)}
                        </td>
                        <td className="py-3 px-2 font-medium">{log.username}</td>
                        <td className="py-3 px-2">
                          <Badge
                            variant={log.success ? "secondary" : "destructive"}
                          >
                            {log.success ? "Success" : "Failed"}
                          </Badge>
                        </td>
                        <td className="py-3 px-2 text-sm text-muted-foreground">
                          {log.failureReason ?? "—"}
                        </td>
                        <td className="py-3 px-2 text-sm font-mono">
                          {log.ipAddress ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {loginRows.length === pageSize && (
              <div className="flex justify-center mt-4">
                <Button asChild variant="outline">
                  <a href={`/audit-logs?tab=logins&loginPage=${loginPage + 1}`}>
                    Load more
                  </a>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
