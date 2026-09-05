"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/app/(dashboard)/actions";
import { cn } from "@/lib/utils";

export function LogoutButton({
  className,
  showLabel = true,
}: {
  className?: string;
  showLabel?: boolean;
}) {
  return (
    <form action={logoutAction}>
      <Button
        type="submit"
        variant="ghost"
        size={showLabel ? "sm" : "icon"}
        className={cn("text-muted-foreground hover:text-foreground", className)}
        title="Log out"
        aria-label="Log out"
      >
        <LogOut className="h-4 w-4" />
        {showLabel && <span>Log out</span>}
      </Button>
    </form>
  );
}
