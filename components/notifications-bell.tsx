"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  markOneNotificationRead,
  markNotificationsReadAll,
} from "@/app/(dashboard)/notifications/actions";

type Item = {
  id: number;
  title: string;
  body: string;
  href: string | null;
  createdAt: string;
};

export function NotificationsBell({
  unreadCount,
  items,
}: {
  unreadCount: number;
  items: Item[];
}) {
  const router = useRouter();

  async function openItem(item: Item) {
    await markOneNotificationRead(item.id);
    if (item.href) router.push(item.href);
    else router.refresh();
  }

  return (
    <div className="relative group">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="relative"
        asChild
      >
        <Link href="/notifications" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Link>
      </Button>

      {items.length > 0 && (
        <div className="invisible absolute right-0 z-50 mt-1 w-80 rounded-lg border bg-popover p-2 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
          <div className="mb-1 flex items-center justify-between px-2 py-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Notifications
            </p>
            {unreadCount > 0 && (
              <button
                type="button"
                className="text-[11px] text-primary underline"
                onClick={async () => {
                  await markNotificationsReadAll();
                  router.refresh();
                }}
              >
                Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="w-full rounded-md px-2 py-2 text-left hover:bg-muted"
                  onClick={() => openItem(item)}
                >
                  <p className="text-sm font-medium leading-snug">{item.title}</p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {item.body}
                  </p>
                </button>
              </li>
            ))}
          </ul>
          <Link
            href="/notifications"
            className="mt-1 block px-2 py-1 text-center text-xs text-primary underline"
          >
            View all
          </Link>
        </div>
      )}
    </div>
  );
}
