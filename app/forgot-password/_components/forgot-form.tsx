"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordResetAction } from "../actions";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, null);

  if (state?.message) {
    return (
      <div className="space-y-5">
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
          {state.message}
        </div>
        <Button asChild variant="outline" className="h-11 w-full">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      {state?.error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {state.error}
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="identifier">Username or email</Label>
        <div className="relative">
          <User className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="identifier"
            name="identifier"
            autoComplete="username"
            placeholder="Enter your username"
            className="h-11 pl-9"
            required
          />
        </div>
      </div>
      <Button type="submit" className="h-11 w-full text-sm font-semibold" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : "Request password reset"}
      </Button>
      <p className="text-center text-sm">
        <Link href="/login" className="text-muted-foreground underline-offset-2 hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
