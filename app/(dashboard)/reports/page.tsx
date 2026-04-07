import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  User,
  Trophy,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";

const reportTypes = [
  {
    title: "By Course",
    description: "View performance reports filtered by course and intake",
    icon: BookOpen,
    href: "/reports/by-course",
  },
  {
    title: "By Student",
    description: "View individual student performance history",
    icon: User,
    href: "/reports/by-student",
  },
  {
    title: "Top Performers",
    description: "Students with highest grades and rankings",
    icon: Trophy,
    href: "/reports/top-performers",
  },
  {
    title: "Failures & At-Risk",
    description: "Students who failed or are at risk of failing",
    icon: AlertTriangle,
    href: "/reports/failures",
  },
];

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Generate and view various performance reports"
      />

      <div className="grid gap-6 md:grid-cols-2">
        {reportTypes.map((report) => (
          <Card key={report.href} className="hover:bg-muted/50 transition-colors">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-primary/10">
                  <report.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">{report.title}</CardTitle>
                  <CardDescription>{report.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link href={report.href}>
                  View Report
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
