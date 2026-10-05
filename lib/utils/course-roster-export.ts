/**
 * Client-side Word / PDF export for course intake rosters (formal document style).
 */

export type ExportColumn = {
  key: string;
  header: string;
};

export type RosterExportOptions = {
  data: Record<string, unknown>[];
  columns: ExportColumn[];
  filename: string;
  title?: string;
  subtitle?: string;
};

const GREEN: [number, number, number] = [26, 92, 46];

function todayLabel(): string {
  return new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function cellText(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (value == null || value === "") return "—";
  return String(value);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Formal PDF roster (Word-document style letterhead). */
export async function exportRosterPdf(opts: RosterExportOptions): Promise<void> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const landscape = opts.columns.length > 5;
  const doc = new jsPDF({
    orientation: landscape ? "landscape" : "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = 14;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("TANZANIA PEOPLE'S DEFENCE FORCE", pageWidth / 2, y, {
    align: "center",
  });
  y += 6;
  doc.setFontSize(13);
  doc.text("SCHOOL OF FIELD ARTILLERY", pageWidth / 2, y, { align: "center" });
  y += 6;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("COURSE NOMINAL ROLL", pageWidth / 2, y, { align: "center" });
  y += 4;

  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.6);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  if (opts.title) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    const titleLines = doc.splitTextToSize(
      opts.title,
      pageWidth - margin * 2
    );
    doc.text(titleLines, margin, y);
    y += titleLines.length * 5 + 2;
  }

  if (opts.subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const subLines = doc.splitTextToSize(
      opts.subtitle,
      pageWidth - margin * 2
    );
    doc.text(subLines, margin, y);
    y += subLines.length * 4 + 2;
  }

  doc.setFontSize(8);
  doc.setTextColor(80);
  doc.text(`Generated: ${todayLabel()}`, margin, y);
  doc.text(`Total: ${opts.data.length}`, pageWidth - margin, y, {
    align: "right",
  });
  doc.setTextColor(0);
  y += 5;

  const tableHeaders = opts.columns.map((c) => c.header);
  const tableRows = opts.data.map((row) =>
    opts.columns.map((col) => cellText(row, col.key))
  );

  autoTable(doc, {
    head: [tableHeaders],
    body: tableRows,
    startY: y,
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 8,
      cellPadding: 2.2,
      lineColor: [180, 180, 180],
      lineWidth: 0.1,
      textColor: [20, 20, 20],
    },
    headStyles: {
      fillColor: GREEN,
      textColor: 255,
      fontStyle: "bold",
      halign: "left",
    },
    alternateRowStyles: {
      fillColor: [245, 248, 245],
    },
    didDrawPage: (data) => {
      const pageCount = doc.getNumberOfPages();
      const pageH = doc.internal.pageSize.getHeight();
      doc.setFontSize(7);
      doc.setTextColor(100);
      doc.text(
        "School of Field Artillery — Official course record",
        margin,
        pageH - 8
      );
      doc.text(
        `Page ${data.pageNumber} of ${pageCount}`,
        pageWidth - margin,
        pageH - 8,
        { align: "right" }
      );
      doc.setTextColor(0);
    },
  });

  doc.save(`${opts.filename}.pdf`);
}

/** Formal Word (.docx) roster matching the PDF layout. */
export async function exportRosterWord(opts: RosterExportOptions): Promise<void> {
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    WidthType,
    AlignmentType,
    BorderStyle,
    HeadingLevel,
    Header,
    Footer,
    PageNumber,
    ShadingType,
  } = await import("docx");

  const border = {
    style: BorderStyle.SINGLE,
    size: 4,
    color: "B4B4B4",
  };
  const borders = { top: border, bottom: border, left: border, right: border };
  const noBorder = {
    style: BorderStyle.NONE,
    size: 0,
    color: "FFFFFF",
  };
  const noBorders = {
    top: noBorder,
    bottom: noBorder,
    left: noBorder,
    right: noBorder,
  };

  const headerCell = (text: string) =>
    new TableCell({
      borders,
      width: { size: Math.floor(9000 / opts.columns.length), type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: "1A5C2E" },
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text,
              bold: true,
              color: "FFFFFF",
              size: 18,
              font: "Calibri",
            }),
          ],
        }),
      ],
    });

  const bodyCell = (text: string) =>
    new TableCell({
      borders,
      width: { size: Math.floor(9000 / opts.columns.length), type: WidthType.DXA },
      children: [
        new Paragraph({
          children: [
            new TextRun({ text, size: 18, font: "Calibri" }),
          ],
        }),
      ],
    });

  const tableRows = [
    new TableRow({
      children: opts.columns.map((c) => headerCell(c.header)),
    }),
    ...opts.data.map(
      (row) =>
        new TableRow({
          children: opts.columns.map((col) =>
            bodyCell(cellText(row, col.key))
          ),
        })
    ),
  ];

  const children = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: "TANZANIA PEOPLE'S DEFENCE FORCE",
          bold: true,
          size: 22,
          font: "Calibri",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: "SCHOOL OF FIELD ARTILLERY",
          bold: true,
          size: 26,
          font: "Calibri",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: "COURSE NOMINAL ROLL",
          size: 20,
          font: "Calibri",
        }),
      ],
    }),
  ];

  if (opts.title) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 80 },
        children: [
          new TextRun({
            text: opts.title,
            bold: true,
            size: 22,
            font: "Calibri",
          }),
        ],
      })
    );
  }

  if (opts.subtitle) {
    children.push(
      new Paragraph({
        spacing: { after: 120 },
        children: [
          new TextRun({
            text: opts.subtitle,
            size: 18,
            font: "Calibri",
            color: "444444",
          }),
        ],
      })
    );
  }

  children.push(
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: `Generated: ${todayLabel()}  ·  Total students: ${opts.data.length}`,
          size: 16,
          italics: true,
          font: "Calibri",
          color: "555555",
        }),
      ],
    }),
    new Table({
      width: { size: 9000, type: WidthType.DXA },
      rows: tableRows,
    }),
    new Paragraph({ spacing: { before: 400 }, children: [] }),
    new Table({
      width: { size: 9000, type: WidthType.DXA },
      columnWidths: [4500, 4500],
      rows: [
        new TableRow({
          children: [
            new TableCell({
              borders: noBorders,
              width: { size: 4500, type: WidthType.DXA },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "_________________________",
                      size: 18,
                      font: "Calibri",
                    }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "Course Commander",
                      size: 16,
                      font: "Calibri",
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              borders: noBorders,
              width: { size: 4500, type: WidthType.DXA },
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({
                      text: "_________________________",
                      size: 18,
                      font: "Calibri",
                    }),
                  ],
                }),
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({
                      text: "Course Coordinator",
                      size: 16,
                      font: "Calibri",
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    })
  );

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720,
              right: 720,
              bottom: 720,
              left: 720,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: "SOFA — Official",
                    size: 14,
                    color: "1A5C2E",
                    font: "Calibri",
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: "School of Field Artillery — Page ",
                    size: 14,
                    color: "666666",
                    font: "Calibri",
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 14,
                    color: "666666",
                    font: "Calibri",
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  triggerDownload(blob, `${opts.filename}.docx`);
}
