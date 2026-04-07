export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { students } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function ByStudentReportPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = params.q?.trim();

  let searchResults: Array<{
    armyNumber: string;
    fullName: string;
    rank: string;
    unit: string | null;
  }> = [];

  if (query && query.length >= 2) {
    // Search students by army number or name
    const allStudents = await db
      .select({
        armyNumber: students.armyNumber,
        fullName: students.fullName,
        rank: students.rank,
        unit: students.unit,
      })
      .from(students)
      .where(eq(students.isActive, true))
      .orderBy(students.fullName);

    // Filter by query (case-insensitive)
    const lowerQuery = query.toLowerCase();
    searchResults = allStudents.filter(
      (s) =>
        s.armyNumber.toLowerCase().includes(lowerQuery) ||
        s.fullName.toLowerCase().includes(lowerQuery)
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Report by Student"
        description="Search for a student to view their performance history"
      />

      {/* Search Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Search Student</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex gap-4">
            <div className="flex-1">
              <Input
                name="q"
                placeholder="Enter army number or student name..."
                defaultValue={query ?? ""}
              />
            </div>
            <Button type="submit">
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Search Results */}
      {query && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Search Results {searchResults.length > 0 && `(${searchResults.length})`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {searchResults.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No students found matching &quot;{query}&quot;
              </p>
            ) : (
              <div className="space-y-2">
                {searchResults.map((student) => (
                  <Link
                    key={student.armyNumber}
                    href={`/students/${student.armyNumber}`}
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted transition-colors"
                  >
                    <div>
                      <p className="font-medium">
                        {student.rank} {student.fullName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {student.armyNumber}
                        {student.unit && ` | ${student.unit}`}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm">
                      View Profile
                    </Button>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!query && (
        <Card>
          <CardContent className="py-12 text-center">
            <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Enter an army number or student name to search
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Results will show the student&apos;s complete course history and performance
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
