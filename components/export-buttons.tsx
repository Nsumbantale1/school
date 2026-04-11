"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDown, FileSpreadsheet, Loader2 } from "lucide-react";

interface ExportColumn {
  key: string;
  header: string;
}

interface ExportButtonsProps {
  data: Record<string, unknown>[];
  columns: ExportColumn[];
  filename: string;
  title?: string;
}

export function ExportButtons({
  data,
  columns,
  filename,
  title,
}: ExportButtonsProps) {
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);

  const exportToCsv = async () => {
    setExportingCsv(true);
    try {
      // Build CSV content
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

      // Download
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
      // Dynamic imports for PDF generation
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);

      const doc = new jsPDF({
        orientation: columns.length > 5 ? "landscape" : "portrait",
        unit: "mm",
        format: "a4",
      });

      // Add title
      if (title) {
        doc.setFontSize(16);
        doc.text(title, 14, 15);
      }

      // Add generation date
      doc.setFontSize(10);
      doc.text(
        `Generated: ${new Date().toLocaleDateString()}`,
        14,
        title ? 22 : 15
      );

      // Prepare table data
      const tableHeaders = columns.map((c) => c.header);
      const tableRows = data.map((row) =>
        columns.map((col) => String(row[col.key] ?? "")),
      );

      // Add table
      autoTable(doc, {
        head: [tableHeaders],
        body: tableRows,
        startY: title ? 28 : 20,
        styles: {
          fontSize: 9,
          cellPadding: 2,
        },
        headStyles: {
          fillColor: [59, 130, 246],
          textColor: 255,
          fontStyle: "bold",
        },
        alternateRowStyles: {
          fillColor: [245, 247, 250],
        },
      });

      // Save
      doc.save(`${filename}.pdf`);
    } catch (error) {
      console.error("PDF export error:", error);
      alert("Failed to export PDF. Please try again.");
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={exportToCsv}
        disabled={exportingCsv || data.length === 0}
      >
        {exportingCsv ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <FileSpreadsheet className="h-4 w-4 mr-2" />
        )}
        Export CSV
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={exportToPdf}
        disabled={exportingPdf || data.length === 0}
      >
        {exportingPdf ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <FileDown className="h-4 w-4 mr-2" />
        )}
        Export PDF
      </Button>
    </div>
  );
}
