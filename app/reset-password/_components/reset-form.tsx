"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { completePasswordResetAction } from "../../forgot-password/actions";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(completePasswordResetAction, null);

  if (state?.done) {
    return (
      <div className="space-y-5">
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
          Your password has been changed. Sign in with the new password.
        </div>
        <Button asChild className="h-11 w-full">
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="token" value={token} />
      {state?.error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {state.error}
        </div>
      )}
      {(["password", "confirm"] as const).map((field) => (
        <div key={field} className="space-y-2">
          <Label htmlFor={field}>{field === "password" ? "New password" : "Repeat new password"}</Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id={field}
              name={field}
              type="password"
              autoComplete="new-password"
              minLength={8}
              className="h-11 pl-9"
              required
            />
          </div>
        </div>
      ))}
      <Button type="submit" className="h-11 w-full text-sm font-semibold" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : "Save new password"}
      </Button>
    </form>
  );
}
