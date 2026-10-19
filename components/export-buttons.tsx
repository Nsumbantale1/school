"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDown, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import {
  exportRosterPdf,
  exportRosterWord,
  type ExportColumn,
} from "@/lib/utils/course-roster-export";

interface ExportButtonsProps {
  data: Record<string, unknown>[];
  columns: ExportColumn[];
  filename: string;
  title?: string;
  subtitle?: string;
  /** Full-course workbook: every student and every subject mark. */
  excelHref?: string;
}

export function ExportButtons({
  data,
  columns,
  filename,
  title,
  subtitle,
  excelHref,
}: ExportButtonsProps) {
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingWord, setExportingWord] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);

  const common = { data, columns, filename, title, subtitle };

  const exportToCsv = async () => {
    setExportingCsv(true);
    try {
      const headers = columns.map((c) => `"${c.header}"`).join(",");
      const rows = data.map((row) =>
        columns
          .map((col) => {
            const formatted = String(row[col.key] ?? "");
            return `"${formatted.replace(/"/g, '""')}"`;
          })
          .join(",")
      );

      const csvContent = [headers, ...rows].join("\n");
      const blob = new Blob(["\ufeff" + csvContent], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${filename}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setExportingCsv(false);
    }
  };

  const exportToPdf = async () => {
    setExportingPdf(true);
    try {
      await exportRosterPdf(common);
    } catch (error) {
      console.error("PDF export error:", error);
      alert("Failed to export PDF. Please try again.");
    } finally {
      setExportingPdf(false);
    }
  };

  const exportToWord = async () => {
    setExportingWord(true);
    try {
      await exportRosterWord(common);
    } catch (error) {
      console.error("Word export error:", error);
      alert("Failed to export Word document. Please try again.");
    } finally {
      setExportingWord(false);
    }
  };

  const busy = exportingPdf || exportingWord || exportingCsv;
  const empty = data.length === 0;

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={exportToWord}
        disabled={busy || empty}
      >
        {exportingWord ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <FileText className="h-4 w-4 mr-2" />
        )}
        Download Word
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={exportToPdf}
        disabled={busy || empty}
      >
        {exportingPdf ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <FileDown className="h-4 w-4 mr-2" />
        )}
        Download PDF
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={exportToCsv}
        disabled={busy || empty}
      >
        {exportingCsv ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <FileSpreadsheet className="h-4 w-4 mr-2" />
        )}
        Export CSV
      </Button>
      {excelHref && (
        <Button variant="outline" size="sm" asChild>
          <a href={excelHref}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Download Excel
          </a>
        </Button>
      )}
    </div>
  );
}
