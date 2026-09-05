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
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-1.5">
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
      <SidebarFooter className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2 px-1">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-sidebar-foreground/70 capitalize">
              {user.role.replace(/_/g, " ")}
            </p>
          </div>
          <ThemeToggle />
        </div>
        <LogoutButton className="mt-2 w-full justify-start" />
      </SidebarFooter>
    </Sidebar>
  );
}
