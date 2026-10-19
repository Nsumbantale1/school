"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2, Pencil, Plus, Power, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ALL_USER_ROLES, type UserRole } from "@/lib/auth/types";
import { createUser, resetUserPassword, setUserActive, updateUser } from "../actions";

export type UserRow = {
  id: number;
  username: string;
  name: string;
  email: string | null;
  role: UserRole;
  assignedCourseId: number | null;
  assignedCourseCode: string | null;
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
};

type CourseOption = { id: number; code: string; name: string };

export type ResetRequest = {
  userId: number;
  name: string;
  username: string;
  role: UserRole;
  createdAt: string;
};

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrator",
  instructor: "Instructor",
  viewer: "Viewer",
  chief_instructor: "Chief Instructor",
  commandant: "Commandant",
};

const ROLE_STYLES: Record<UserRole, string> = {
  admin: "bg-primary/10 text-primary ring-primary/25",
  commandant: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/25",
  chief_instructor: "bg-orange-50 text-orange-700 ring-orange-600/20 dark:bg-orange-400/10 dark:text-orange-300 dark:ring-orange-400/25",
  instructor: "bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-400/10 dark:text-sky-300 dark:ring-sky-400/25",
  viewer: "bg-slate-50 text-slate-700 ring-slate-600/20 dark:bg-slate-400/10 dark:text-slate-300 dark:ring-slate-400/25",
};

const selectClass =
  "border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-[3px]";

type DialogState =
  | { kind: "create" }
  | { kind: "edit"; user: UserRow }
  | { kind: "password"; user: UserRow }
  | null;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

function formatDate(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function UsersManager({
  users,
  courses,
  currentUserId,
  readOnly = false,
  resetRequests = [],
  initialResetUserId,
}: {
  users: UserRow[];
  courses: CourseOption[];
  currentUserId: number;
  readOnly?: boolean;
  resetRequests?: ResetRequest[];
  initialResetUserId?: number;
}) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all");
  const [dialog, setDialog] = useState<DialogState>(() => {
    const target = readOnly ? undefined : users.find((u) => u.id === initialResetUserId);
    return target ? { kind: "password", user: target } : null;
  });
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [, startToggle] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter(
      (u) =>
        (roleFilter === "all" || u.role === roleFilter) &&
        (!q ||
          u.name.toLowerCase().includes(q) ||
          u.username.toLowerCase().includes(q) ||
          (u.email ?? "").toLowerCase().includes(q))
    );
  }, [users, query, roleFilter]);

  function toggleActive(user: UserRow) {
    setTogglingId(user.id);
    startToggle(async () => {
      const result = await setUserActive(user.id, !user.isActive);
      setTogglingId(null);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(user.isActive ? `${user.name} deactivated.` : `${user.name} activated.`);
    });
  }

  return (
    <>
    {resetRequests.length > 0 && (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <KeyRound className="size-4" />
          Forgotten passwords waiting for a new password
        </p>
        <ul className="mt-2 space-y-1.5">
          {resetRequests.map((r) => {
            const target = users.find((u) => u.id === r.userId);
            return (
              <li key={r.userId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>
                  {r.name} <span className="text-amber-800">@{r.username}</span> ·{" "}
                  {ROLE_LABELS[r.role]} · asked {new Date(r.createdAt).toLocaleString("en-GB")}
                </span>
                {!readOnly && target && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 bg-white"
                    onClick={() => setDialog({ kind: "password", user: target })}
                  >
                    Set new password
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    )}
    <Card className="gap-0 py-0">
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row">
          <div className="relative sm:max-w-xs sm:flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, username or email…"
              className="pl-9"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as "all" | UserRole)}
            className={cn(selectClass, "sm:w-48")}
            aria-label="Filter by role"
          >
            <option value="all">All roles</option>
            {ALL_USER_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
        {!readOnly && (
          <Button onClick={() => setDialog({ kind: "create" })}>
            <Plus className="size-4" />
            New user
          </Button>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Course</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last login</TableHead>
            {!readOnly && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={readOnly ? 5 : 6} className="py-10 text-center text-muted-foreground">
                No users match your search.
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((u) => (
              <TableRow key={u.id} className={cn(!u.isActive && "opacity-60")}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {initials(u.name)}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium">
                        {u.name}
                        {u.id === currentUserId && (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">(you)</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        @{u.username}
                        {u.email ? ` · ${u.email}` : ""}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
                      ROLE_STYLES[u.role]
                    )}
                  >
                    {ROLE_LABELS[u.role]}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {u.assignedCourseCode ?? "—"}
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                    <span
                      className={cn(
                        "size-2 rounded-full",
                        u.isActive ? "bg-emerald-500" : "bg-muted-foreground/40"
                      )}
                    />
                    {u.isActive ? "Active" : "Inactive"}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">{formatDate(u.lastLogin)}</TableCell>
                {!readOnly && (
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Edit user"
                      aria-label={`Edit ${u.name}`}
                      onClick={() => setDialog({ kind: "edit", user: u })}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Reset password"
                      aria-label={`Reset password for ${u.name}`}
                      onClick={() => setDialog({ kind: "password", user: u })}
                    >
                      <KeyRound className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title={u.isActive ? "Deactivate" : "Activate"}
                      aria-label={`${u.isActive ? "Deactivate" : "Activate"} ${u.name}`}
                      disabled={u.id === currentUserId || togglingId === u.id}
                      onClick={() => toggleActive(u)}
                      className={u.isActive ? "text-destructive hover:text-destructive" : "text-emerald-600"}
                    >
                      {togglingId === u.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Power className="size-4" />
                      )}
                    </Button>
                  </div>
                </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          {dialog?.kind === "create" && (
            <UserForm courses={courses} onDone={() => setDialog(null)} />
          )}
          {dialog?.kind === "edit" && (
            <UserForm
              key={dialog.user.id}
              user={dialog.user}
              courses={courses}
              onDone={() => setDialog(null)}
            />
          )}
          {dialog?.kind === "password" && (
            <PasswordForm user={dialog.user} onDone={() => setDialog(null)} />
          )}
        </DialogContent>
      </Dialog>
    </Card>
    </>
  );
}

function UserForm({
  user,
  courses,
  onDone,
}: {
  user?: UserRow;
  courses: CourseOption[];
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [role, setRole] = useState<UserRole>(user?.role ?? "viewer");
  const isEdit = Boolean(user);

  function submit(fd: FormData) {
    startTransition(async () => {
      const result = isEdit ? await updateUser(fd) : await createUser(fd);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(isEdit ? "User updated." : "User created.");
      onDone();
    });
  }

  return (
    <form action={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{isEdit ? "Edit user" : "New user"}</DialogTitle>
        <DialogDescription>
          {isEdit ? `Update details for @${user!.username}.` : "Create an account and assign a role."}
        </DialogDescription>
      </DialogHeader>

      {isEdit && <input type="hidden" name="id" value={user!.id} />}

      <div className="grid gap-2">
        <Label htmlFor="name">Full name</Label>
        <Input id="name" name="name" defaultValue={user?.name} required maxLength={100} />
      </div>

      {!isEdit && (
        <div className="grid gap-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            name="username"
            required
            maxLength={50}
            pattern="[A-Za-z0-9._\-]{3,50}"
            autoComplete="off"
            placeholder="e.g. jmrisho"
          />
        </div>
      )}

      <div className="grid gap-2">
        <Label htmlFor="email">Email (optional)</Label>
        <Input id="email" name="email" type="email" defaultValue={user?.email ?? ""} maxLength={120} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="role">Role</Label>
        <select
          id="role"
          name="role"
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole)}
          className={selectClass}
        >
          {ALL_USER_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </div>

      {role === "instructor" && (
        <div className="grid gap-2">
          <Label htmlFor="assignedCourseId">Assigned course</Label>
          <select
            id="assignedCourseId"
            name="assignedCourseId"
            defaultValue={user?.assignedCourseId ?? ""}
            className={selectClass}
          >
            <option value="">All courses</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {!isEdit && (
        <div className="grid gap-2">
          <Label htmlFor="password">Temporary password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
          <p className="text-xs text-muted-foreground">At least 8 characters.</p>
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {isEdit ? "Save changes" : "Create user"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function PasswordForm({ user, onDone }: { user: UserRow; onDone: () => void }) {
  const [pending, startTransition] = useTransition();

  function submit(fd: FormData) {
    if (fd.get("password") !== fd.get("confirm")) {
      toast.error("Passwords do not match.");
      return;
    }
    startTransition(async () => {
      const result = await resetUserPassword(fd);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`Password reset for ${user.name}.`);
      onDone();
    });
  }

  return (
    <form action={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Reset password</DialogTitle>
        <DialogDescription>Set a new password for @{user.username}.</DialogDescription>
      </DialogHeader>
      <input type="hidden" name="id" value={user.id} />
      <div className="grid gap-2">
        <Label htmlFor="password">New password</Label>
        <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="confirm">Confirm password</Label>
        <Input id="confirm" name="confirm" type="password" required minLength={8} autoComplete="new-password" />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Reset password
        </Button>
      </DialogFooter>
    </form>
  );
}
