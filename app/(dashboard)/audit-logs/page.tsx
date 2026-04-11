export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { desc, eq, and, gte, lte } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Search, Filter } from "lucide-react";

interface PageProps {
  searchParams: Promise<{
    table?: string;
    action?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}

const ALL = "__all__";

export default async function AuditLogsPage({ searchParams }: PageProps) {
  await requireRole(["admin"]);
  const raw = await searchParams;
  const params = {
    ...raw,
    table: raw.table && raw.table !== ALL ? raw.table : undefined,
    action: raw.action && raw.action !== ALL ? raw.action : undefined,
  };

  const page = params.page ? parseInt(params.page) : 1;
  const pageSize = 50;
  const offset = (page - 1) * pageSize;

  // Build query conditions
  const conditions = [];

  if (params.table) {
    conditions.push(eq(auditLogs.tableName, params.table));
  }
  if (params.action) {
    conditions.push(eq(auditLogs.action, params.action as "create" | "update" | "delete"));
  }
  if (params.from) {
    conditions.push(gte(auditLogs.createdAt, new Date(params.from)));
  }
  if (params.to) {
    conditions.push(lte(auditLogs.createdAt, new Date(params.to + "T23:59:59")));
  }

  // Get logs with filtering
  const logs = await db
    .select()
    .from(auditLogs)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(auditLogs.createdAt))
    .limit(pageSize)
    .offset(offset);

  // Get distinct table names for filter
  const tables = await db
    .selectDistinct({ tableName: auditLogs.tableName })
    .from(auditLogs)
    .orderBy(auditLogs.tableName);

  const getActionBadgeColor = (action: string) => {
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Logs"
        description="Track all changes made to the system"
      />

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-5">
            <div className="space-y-2">
              <label className="text-sm font-medium">Table</label>
              <Select name="table" defaultValue={params.table ?? ALL}>
                <SelectTrigger>
                  <SelectValue placeholder="All tables" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All tables</SelectItem>
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
              <Input type="date" name="from" defaultValue={params.from ?? ""} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">To</label>
              <Input type="date" name="to" defaultValue={params.to ?? ""} />
            </div>

            <div className="flex items-end">
              <Button type="submit" className="w-full">
                <Search className="mr-2 h-4 w-4" />
                Apply Filters
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Recent Activity ({logs.length} records)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No audit logs found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">Timestamp</th>
                    <th className="text-left py-3 px-2 font-medium">User</th>
                    <th className="text-left py-3 px-2 font-medium">Action</th>
                    <th className="text-left py-3 px-2 font-medium">Table</th>
                    <th className="text-left py-3 px-2 font-medium">Record ID</th>
                    <th className="text-left py-3 px-2 font-medium">Changes</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.logId} className="border-b">
                      <td className="py-3 px-2 text-sm">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-2">
                        {log.userName || "System"}
                      </td>
                      <td className="py-3 px-2">
                        <Badge
                          variant="outline"
                          className={`capitalize ${getActionBadgeColor(log.action)}`}
                        >
                          {log.action}
                        </Badge>
                      </td>
                      <td className="py-3 px-2 font-mono text-sm">
                        {log.tableName}
                      </td>
                      <td className="py-3 px-2 font-mono text-sm">
                        {log.recordId}
                      </td>
                      <td className="py-3 px-2">
                        {log.action === "create" && log.newValues != null && (
                          <details className="text-sm">
                            <summary className="cursor-pointer text-muted-foreground">
                              View new values
                            </summary>
                            <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-x-auto max-w-md">
                              {JSON.stringify(log.newValues as Record<string, unknown>, null, 2)}
                            </pre>
                          </details>
                        )}
                        {log.action === "update" && (
                          <details className="text-sm">
                            <summary className="cursor-pointer text-muted-foreground">
                              View changes
                            </summary>
                            <div className="mt-2 space-y-2">
                              {log.oldValues != null && (
                                <div>
                                  <p className="text-xs font-medium text-red-600">Old:</p>
                                  <pre className="text-xs bg-red-50 dark:bg-red-950/20 p-2 rounded overflow-x-auto max-w-md">
                                    {JSON.stringify(log.oldValues as Record<string, unknown>, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {log.newValues != null && (
                                <div>
                                  <p className="text-xs font-medium text-green-600">New:</p>
                                  <pre className="text-xs bg-green-50 dark:bg-green-950/20 p-2 rounded overflow-x-auto max-w-md">
                                    {JSON.stringify(log.newValues as Record<string, unknown>, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </details>
                        )}
                        {log.action === "delete" && log.oldValues != null && (
                          <details className="text-sm">
                            <summary className="cursor-pointer text-muted-foreground">
                              View deleted values
                            </summary>
                            <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-x-auto max-w-md">
                              {JSON.stringify(log.oldValues as Record<string, unknown>, null, 2)}
                            </pre>
                          </details>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {logs.length === pageSize && (
            <div className="flex justify-center mt-4">
              <Button asChild variant="outline">
                <a
                  href={`/audit-logs?${new URLSearchParams({
                    ...(params.table && { table: params.table }),
                    ...(params.action && { action: params.action }),
                    ...(params.from && { from: params.from }),
                    ...(params.to && { to: params.to }),
                    page: String(page + 1),
                  })}`}
                >
                  Load More
                </a>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
