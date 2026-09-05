"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { updateOfficialContactEmail } from "@/app/(dashboard)/notifications/actions";

type OfficialUser = {
  id: number;
  username: string;
  name: string;
  role: string;
  email: string | null;
};

export function OfficialContactEmails({
  officials,
}: {
  officials: OfficialUser[];
}) {
  const [pendingId, setPendingId] = useState<number | null>(null);

  async function save(userId: number, form: HTMLFormElement) {
    setPendingId(userId);
    const fd = new FormData(form);
    fd.set("userId", String(userId));
    const result = await updateOfficialContactEmail(fd);
    setPendingId(null);
    if (!result.success) {
      toast.error(result.error ?? "Failed to save email.");
      return;
    }
    toast.success("Email saved. Approvals will also be emailed when SMTP is set.");
  }

  if (officials.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Official login emails</CardTitle>
          <CardDescription>
            Create Chief Instructor / Commandant accounts first (
            <code className="text-xs">npx tsx scripts/create-official-users.ts</code>
            ).
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Official contact emails</CardTitle>
        <CardDescription>
          When Admin submits a certificate request, CI and Commandant get an
          in-app alert. If SMTP is configured and email is set here, they also
          get email in their office inbox.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {officials.map((u) => (
          <form
            key={u.id}
            className="grid gap-2 sm:grid-cols-[1fr_2fr_auto] sm:items-end"
            onSubmit={async (e) => {
              e.preventDefault();
              await save(u.id, e.currentTarget);
            }}
          >
            <div>
              <p className="text-sm font-medium">{u.name}</p>
              <p className="text-xs text-muted-foreground">
                @{u.username} · {u.role.replace(/_/g, " ")}
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor={`email-${u.id}`}>Email</Label>
              <Input
                id={`email-${u.id}`}
                name="email"
                type="email"
                defaultValue={u.email ?? ""}
                placeholder="name@example.com"
              />
            </div>
            <Button type="submit" disabled={pendingId === u.id}>
              {pendingId === u.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Save"
              )}
            </Button>
          </form>
        ))}
      </CardContent>
    </Card>
  );
}
