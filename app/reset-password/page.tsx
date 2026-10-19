export const dynamic = "force-dynamic";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { isResetTokenValid } from "@/lib/utils/password-reset";
import { AuthCard } from "../forgot-password/_components/auth-card";
import { ResetPasswordForm } from "./_components/reset-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;
  const valid = token ? await isResetTokenValid(token) : false;

  if (!valid) {
    return (
      <AuthCard
        title="Link not valid"
        subtitle="This reset link is invalid, already used, or older than 30 minutes."
      >
        <Button asChild className="h-11 w-full">
          <Link href="/forgot-password">Ask for a new link</Link>
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Choose a new password" subtitle="Use at least 8 characters.">
      <ResetPasswordForm token={token} />
    </AuthCard>
  );
}
