export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { documents, students, users } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/guards";
import { FileText, Download, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { studentPath } from "@/lib/utils";

export default async function DocumentsPage() {
  await requireRole(["admin"]);

  const docs = await db
    .select({
      documentId: documents.documentId,
      fileName: documents.fileName,
      fileType: documents.fileType,
      fileSize: documents.fileSize,
      filePath: documents.filePath,
      description: documents.description,
      createdAt: documents.createdAt,
      studentArmyNumber: documents.studentArmyNumber,
      studentName: students.fullName,
      uploadedByName: users.name,
    })
    .from(documents)
    .leftJoin(students, eq(documents.studentArmyNumber, students.armyNumber))
    .leftJoin(users, eq(documents.uploadedBy, users.id))
    .orderBy(desc(documents.createdAt));

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case "pdf":
        return "text-red-600";
      case "jpg":
      case "jpeg":
      case "png":
        return "text-blue-600";
      case "doc":
      case "docx":
        return "text-blue-800";
      default:
        return "text-gray-600";
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        description="Manage uploaded certificates and files"
      >
        <Button disabled>
          <Upload className="mr-2 h-4 w-4" />
          Upload Document
        </Button>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            All Documents ({docs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {docs.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No documents uploaded yet.</p>
              <p className="text-sm text-muted-foreground mt-2">
                Document upload feature will be available soon.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">File Name</th>
                    <th className="text-left py-3 px-2 font-medium">Type</th>
                    <th className="text-left py-3 px-2 font-medium">Size</th>
                    <th className="text-left py-3 px-2 font-medium">Student</th>
                    <th className="text-left py-3 px-2 font-medium">Uploaded By</th>
                    <th className="text-left py-3 px-2 font-medium">Date</th>
                    <th className="text-left py-3 px-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {docs.map((doc) => (
                    <tr key={doc.documentId} className="border-b">
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          <FileText
                            className={`h-4 w-4 ${getFileTypeIcon(doc.fileType)}`}
                          />
                          <div>
                            <p className="font-medium">{doc.fileName}</p>
                            {doc.description && (
                              <p className="text-sm text-muted-foreground">
                                {doc.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <Badge variant="outline" className="uppercase">
                          {doc.fileType}
                        </Badge>
                      </td>
                      <td className="py-3 px-2 text-sm">
                        {formatFileSize(doc.fileSize)}
                      </td>
                      <td className="py-3 px-2">
                        {doc.studentArmyNumber ? (
                          <Link
                            href={studentPath(doc.studentArmyNumber)}
                            className="hover:underline"
                          >
                            {doc.studentName || doc.studentArmyNumber}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-3 px-2">{doc.uploadedByName || "—"}</td>
                      <td className="py-3 px-2 text-sm">
                        {new Date(doc.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" disabled>
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" disabled>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-2 rounded-md bg-blue-100 dark:bg-blue-900">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-medium">Document Management</h3>
              <p className="text-sm text-muted-foreground mt-1">
                This section allows administrators to manage uploaded documents such as
                certificates, transcripts, and other files associated with students
                and their enrollments. File upload functionality requires additional
                storage configuration.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
