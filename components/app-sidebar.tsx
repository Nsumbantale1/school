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
  LogOut,
  FileBarChart,
  TrendingUp,
  UserCog,
  History,
  FileText,
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
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { logoutAction } from "@/app/(dashboard)/actions";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
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
      { title: "Intakes", href: "/intakes", icon: Calendar },
      { title: "Enrollments", href: "/enrollments", icon: ClipboardList },
      { title: "Results", href: "/results", icon: Award },
    ],
  },
  {
    label: "Reports",
    items: [
      { title: "Reports", href: "/reports", icon: FileBarChart },
      { title: "Analytics", href: "/analytics", icon: TrendingUp },
    ],
  },
  {
    label: "Admin",
    items: [
      { title: "Users", href: "/users", icon: UserCog, adminOnly: true },
      { title: "Audit Logs", href: "/audit-logs", icon: History, adminOnly: true },
      { title: "Documents", href: "/documents", icon: FileText, adminOnly: true },
    ],
  },
];

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
      <SidebarHeader className="h-14 justify-center border-b border-sidebar-border px-4">
        <div className="flex items-center gap-2">
          <Image
            src="/school-of-artillery.png"
            alt="School of Artillery crest"
            width={40}
            height={31}
            className="h-8 w-auto shrink-0 rounded-sm bg-white p-0.5"
          />
          <span className="text-sm font-semibold">School of Field Artillery</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {navGroups.map((group) => {
          // Filter out admin-only items for non-admin users
          const visibleItems = group.items.filter(
            (item) => !item.adminOnly || isAdmin
          );

          // Don't render empty groups
          if (visibleItems.length === 0) return null;

          return (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-1.5">
                  {visibleItems.map((item) => {
                    const isActive =
                      pathname === item.href ||
                      (item.href !== "/dashboard" &&
                        pathname.startsWith(item.href));
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton asChild isActive={isActive}>
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
      <SidebarFooter className="border-t border-sidebar-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{user.name}</p>
            <p className="text-xs text-sidebar-foreground/70 capitalize">
              {user.role.replace(/_/g, " ")}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <form action={logoutAction}>
              <Button variant="ghost" size="icon" type="submit">
                <LogOut className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
