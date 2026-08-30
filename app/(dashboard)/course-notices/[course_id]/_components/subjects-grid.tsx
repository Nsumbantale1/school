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
import { BookOpen, Megaphone, ChevronRight } from "lucide-react";

interface SubjectCardProps {
  subjectId: number;
  courseId: number;
  subjectName: string;
  maxMarks: string;
  noticeCount: number;
}

export function SubjectsGrid({ subjects }: { subjects: SubjectCardProps[] }) {
  if (subjects.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <BookOpen className="mx-auto h-10 w-10 mb-3 opacity-40" />
          <p>
            No subjects found for this course. Add subjects under Courses — they
            will appear here automatically.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {subjects.map((s) => (
        <Link
          key={s.subjectId}
          href={`/course-notices/${s.courseId}/${s.subjectId}`}
        >
          <Card className="h-full hover:bg-muted/50 transition-colors cursor-pointer group">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{s.subjectName}</CardTitle>
                  <CardDescription className="mt-1">
                    Max marks: {s.maxMarks}
                  </CardDescription>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground shrink-0" />
              </div>
            </CardHeader>
            <CardContent>
              <Badge variant="secondary" className="gap-1">
                <Megaphone className="h-3 w-3" />
                {s.noticeCount} notice{s.noticeCount !== 1 ? "s" : ""}
              </Badge>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
