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
  subtitle?: string;
}

export function ExportButtons({
  data,
  columns,
  filename,
  title,
  subtitle,
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
      let startY = 15;
      if (title) {
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(title, 14, startY);
        startY += 7;
      }

      if (subtitle) {
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        const lines = doc.splitTextToSize(subtitle, 270);
        doc.text(lines, 14, startY);
        startY += lines.length * 4 + 2;
      }

      // Add generation date
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(
        `Generated: ${new Date().toLocaleDateString("en-GB")}`,
        14,
        startY
      );
      startY += 6;

      // Prepare table data
      const tableHeaders = columns.map((c) => c.header);
      const tableRows = data.map((row) =>
        columns.map((col) => String(row[col.key] ?? "")),
      );

      // Add table
      autoTable(doc, {
        head: [tableHeaders],
        body: tableRows,
        startY,
        styles: {
          fontSize: 8,
          cellPadding: 2,
        },
        headStyles: {
          fillColor: [26, 92, 46],
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
        Download PDF
      </Button>
    </div>
  );
}
