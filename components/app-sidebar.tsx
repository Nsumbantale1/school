"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Calendar,
  ClipboardList,
  Award,
  FileBarChart,
  TrendingUp,
  ArrowLeftRight,
  UserCog,
  History,
  FileText,
  HardDrive,
  Megaphone,
  Presentation,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { PaletteSwitcher } from "@/components/palette-switcher";
import { LogoutButton } from "@/components/logout-button";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  /** If set, item visible only for these roles */
  roles?: string[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: "Operations",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { title: "Students", href: "/students", icon: Users },
    ],
  },
  {
    label: "Training",
    items: [
      { title: "Courses", href: "/courses", icon: BookOpen },
      { title: "Course Notices", href: "/course-notices", icon: Megaphone },
      { title: "Presentations", href: "/presentations", icon: Presentation },
      { title: "Intakes", href: "/intakes", icon: Calendar },
      { title: "Enrollments", href: "/enrollments", icon: ClipboardList },
      { title: "Results", href: "/results", icon: Award },
      {
        title: "Certificates",
        href: "/certificates",
        icon: FileText,
        roles: ["admin", "chief_instructor", "commandant"],
      },
    ],
  },
  {
    label: "Reports",
    items: [
      { title: "Reports", href: "/reports", icon: FileBarChart },
      { title: "Analytics", href: "/analytics", icon: TrendingUp },
      {
        title: "Comparative",
        href: "/analytics/comparative",
        icon: ArrowLeftRight,
      },
    ],
  },
  {
    label: "Admin",
    items: [
      { title: "Users", href: "/users", icon: UserCog, adminOnly: true },
      { title: "Activity Logs", href: "/audit-logs", icon: History, adminOnly: true },
      { title: "Documents", href: "/documents", icon: FileText, adminOnly: true },
      {
        title: "Cert. Signatures",
        href: "/settings/signatures",
        icon: Award,
        adminOnly: true,
      },
      {
        title: "Backup",
        href: "/settings/backup",
        icon: HardDrive,
        adminOnly: true,
      },
    ],
  },
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

interface AppSidebarProps {
  user: {
    name: string;
    role: string;
  };
}

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();
  const isAdmin = user.role === "admin";

  return (
    <Sidebar variant="inset">
      <SidebarHeader className="px-3 pt-4 pb-3">
        <Link
          href="/dashboard"
          className="relative flex items-center gap-3 overflow-hidden rounded-xl bg-white/[0.04] p-2.5 pb-3 ring-1 ring-white/10 transition-colors hover:bg-white/[0.07]"
        >
          <span className="bg-regimental-ribbon absolute inset-x-0 bottom-0 h-[3px]" />
          <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-white p-1 shadow-sm">
            <Image
              src="/school-of-artillery.png"
              alt="School of Artillery crest"
              width={40}
              height={31}
              className="h-auto w-full"
            />
          </div>
          <div className="min-w-0 leading-tight">
            <p className="font-[family-name:var(--font-display)] text-[13px] leading-snug font-semibold text-white">
              School of Field Artillery
            </p>
            <p className="mt-0.5 truncate text-[11px] font-medium uppercase tracking-[0.14em] text-sidebar-primary">
              Training Records
            </p>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent className="px-1">
        {navGroups.map((group) => {
          const visibleItems = group.items.filter((item) => {
            if (item.roles) return item.roles.includes(user.role);
            if (item.adminOnly) return isAdmin;
            // Officials mainly use Certificates — hide heavy ops menus
            if (
              user.role === "chief_instructor" ||
              user.role === "commandant"
            ) {
              return (
                item.href === "/dashboard" || item.href === "/certificates"
              );
            }
            return true;
          });

          if (visibleItems.length === 0) return null;

          return (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/45">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  {visibleItems.map((item) => {
                    const isActive =
                      pathname === item.href ||
                      (item.href !== "/dashboard" &&
                        pathname.startsWith(item.href) &&
                        !(
                          item.href === "/analytics" &&
                          pathname.startsWith("/analytics/comparative")
                        )) ||
                      (item.href === "/analytics/comparative" &&
                        pathname.startsWith("/analytics/comparative"));
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          className="relative h-9 rounded-lg px-3 text-sidebar-foreground/75 transition-colors hover:text-white data-active:bg-gradient-to-r data-active:from-white/[0.11] data-active:to-white/[0.03] data-active:font-semibold data-active:text-white data-active:shadow-[inset_0_0_0_1px_oklch(1_0_0/0.06)] data-active:before:absolute data-active:before:inset-y-2 data-active:before:left-0 data-active:before:w-[3px] data-active:before:rounded-r-full data-active:before:bg-sidebar-primary data-active:[&_svg]:text-sidebar-primary"
                        >
                          <Link href={item.href}>
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
      <SidebarFooter className="p-3">
        <div className="rounded-xl bg-white/[0.04] p-2 ring-1 ring-white/10">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sidebar-primary to-highlight-deep text-xs font-bold text-sidebar-primary-foreground">
              {initials(user.name)}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-semibold text-white">{user.name}</p>
              <p className="truncate text-[11px] capitalize text-sidebar-foreground/60">
                {user.role.replace(/_/g, " ")}
              </p>
            </div>
            <PaletteSwitcher className="text-sidebar-foreground/70 hover:bg-white/10 hover:text-white" />
            <ThemeToggle className="text-sidebar-foreground/70 hover:bg-white/10 hover:text-white" />
          </div>
          <LogoutButton className="mt-1.5 h-8 w-full justify-start text-sidebar-foreground/70 hover:bg-white/10 hover:text-white" />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
