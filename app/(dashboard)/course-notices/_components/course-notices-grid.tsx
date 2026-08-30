"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Megaphone, Dumbbell, ChevronRight } from "lucide-react";

interface CourseCardProps {
  courseId: number;
  courseCode: string;
  courseName: string;
  durationWeeks: number;
  noticeCount: number;
  exerciseCount: number;
}

export function CourseNoticesGrid({ courses }: { courses: CourseCardProps[] }) {
  if (courses.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <BookOpen className="mx-auto h-10 w-10 mb-3 opacity-40" />
          <p>No courses found. Add a course first — it will appear here automatically.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {courses.map((c) => (
        <Link key={c.courseId} href={`/course-notices/${c.courseId}`}>
          <Card className="h-full hover:bg-muted/50 transition-colors cursor-pointer group">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-lg">{c.courseCode}</CardTitle>
                  <CardDescription className="line-clamp-2 mt-1">
                    {c.courseName}
                  </CardDescription>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground shrink-0" />
              </div>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="gap-1">
                <Megaphone className="h-3 w-3" />
                {c.noticeCount} notice{c.noticeCount !== 1 ? "s" : ""}
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Dumbbell className="h-3 w-3" />
                {c.exerciseCount} exercise{c.exerciseCount !== 1 ? "s" : ""}
              </Badge>
              <Badge variant="outline">{c.durationWeeks} weeks</Badge>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
