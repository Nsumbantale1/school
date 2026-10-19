import type {
  PDFDocument,
  PDFEmbeddedPage,
  PDFFont,
  PDFImage,
  PDFPage,
  RGB,
} from "pdf-lib";
import type { CertificateData } from "./certificate-data";
import { formatDateOnly } from "./format-date";

/**
 * Field boxes are the dotted blanks on the original Word certificates
 * (CHETI ASKARI B / CHETI CHA AFISA), measured in PDF points.
 * y is the baseline of the printed dots. Filled text is drawn above them.
 */
type Box = { x: number; y: number; w: number };

type CertificateLayout = {
  army: Box;
  rank: Box;
  name: Box;
  course: Box;
  intake: Box;
  school: Box;
  from: Box;
  to: Box;
  sigLeft: Box;
  sigRight: Box;
  dateLeft: Box;
  dateRight: Box;
};

/** Measured on page 1 of CHETI ASKARI B.doc (the official askari certificate). */
const ASKARI: CertificateLayout = {
  army: { x: 120, y: 422, w: 87.9 },
  rank: { x: 238.4, y: 422, w: 39.7 },
  name: { x: 348, y: 422, w: 189.8 },
  course: { x: 72, y: 335.4, w: 468 },
  intake: { x: 72.4, y: 298.4, w: 467.3 },
  school: { x: 72.4, y: 226.3, w: 467.3 },
  from: { x: 124, y: 193.5, w: 180 },
  to: { x: 344, y: 193.5, w: 188 },
  sigLeft: { x: 72, y: 143.4, w: 195.8 },
  sigRight: { x: 324.1, y: 143.4, w: 195.8 },
  dateLeft: { x: 177.5, y: 76.8, w: 75.6 },
  dateRight: { x: 394, y: 76.8, w: 75.6 },
};

/** Measured on page 1 of CHETI CHA AFISA.docx (the official officers certificate). */
const AFISA: CertificateLayout = {
  army: { x: 120, y: 415.5, w: 63 },
  rank: { x: 217.5, y: 415.5, w: 39.7 },
  name: { x: 323.2, y: 415.5, w: 211.6 },
  course: { x: 72, y: 329, w: 468 },
  intake: { x: 72.4, y: 292, w: 467.3 },
  school: { x: 72.4, y: 219.9, w: 467.3 },
  from: { x: 124, y: 187, w: 180 },
  to: { x: 344, y: 187, w: 188 },
  sigLeft: { x: 72, y: 137.1, w: 195.8 },
  sigRight: { x: 324.1, y: 137.1, w: 195.8 },
  dateLeft: { x: 177.1, y: 70.5, w: 75.9 },
  dateRight: { x: 393.8, y: 70.5, w: 75.9 },
};

/** How far above the dotted baseline the filled-in words sit. The dots stay. */
const TEXT_LIFT = 7;

/**
 * The Word export drew two thick red diagonals across the crest and the
 * arched force name. They are removed from the page content; the crest stays.
 */
const CREST_DIAGONAL =
  /\/P <<\/MCID \d+>> BDC 10 w\r?\n1 0 0 RG\r?\n 1 j ?\r?\n134\.15 [\d.]+ m\r?\n480\.35 [\d.]+ l\r?\nS\r?\n EMC\s*\/P <<\/MCID \d+>> BDC ?\r?\n166\.7 [\d.]+ m\r?\n447\.2 [\d.]+ l\r?\nS\r?\n EMC/;

const ENLISTED = new Set([
  "pte",
  "pvt",
  "private",
  "lcpl",
  "cpl",
  "corporal",
  "sgt",
  "sergeant",
  "ssgt",
  "wo",
  "wo1",
  "woi",
  "wo2",
  "woii",
  "rsm",
  "csm",
]);

export type CertificateKind = "askari" | "afisa";

export function certificateKind(rank: string): CertificateKind {
  const normalized = rank.trim().toLowerCase().replace(/\./g, "");
  const compact = normalized.replace(/[^a-z0-9]/g, "");
  if (ENLISTED.has(compact) || ENLISTED.has(normalized)) return "askari";
  if (
    /^(2lt|lt|capt|maj|ltcol|col|brig|majgen|ltgen|gen)/.test(compact) ||
    /^(second lieutenant|lieutenant|captain|major|colonel|brigadier|general)\b/.test(
      normalized
    )
  ) {
    return "afisa";
  }
  return "askari";
}

function layoutFor(kind: CertificateKind): CertificateLayout {
  return kind === "afisa" ? AFISA : ASKARI;
}

function formatCertDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  const formatted = formatDateOnly(value, "medium");
  return formatted === "—" ? "" : formatted;
}

function formatIntakeLabel(intakeNumber: string): string {
  const trimmed = intakeNumber.trim().replace(/\s+/g, " ");
  const withoutPrefix = trimmed.replace(/^int(?:ake)?\s*[-:]?\s*/i, "").trim();
  return withoutPrefix || trimmed;
}

function formatArmyNumber(armyNumber: string): string {
  const trimmed = armyNumber.trim();
  const match = trimmed.match(/^([A-Za-z]+)\s*(.+)$/);
  if (match) return `${match[1].toUpperCase()} ${match[2]}`;
  return trimmed.toUpperCase();
}

/** Edward Andrew Lukelesho, including a hyphen or apostrophe inside a name. */
function certificateName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/(^|[^a-z])([a-z])/g, (_sep, lead: string, letter: string) => lead + letter.toUpperCase());
}

export interface SignatureStamp {
  bytes: Uint8Array;
  kind: "png" | "jpg";
}

function fitSize(font: PDFFont, text: string, maxWidth: number, preferred: number) {
  let size = preferred;
  while (size > 7 && font.widthOfTextAtSize(text, size) > maxWidth) {
    size -= 0.25;
  }
  return size;
}

function drawInBox(
  page: PDFPage,
  font: PDFFont,
  text: string,
  box: Box,
  preferred: number,
  color: RGB
) {
  const value = text.trim();
  if (!value) return;
  const size = fitSize(font, value, Math.max(8, box.w - 2), preferred);
  const width = font.widthOfTextAtSize(value, size);
  const x = box.x + Math.max(0, (box.w - width) / 2);
  page.drawText(value, {
    x,
    y: box.y + TEXT_LIFT,
    size,
    font,
    color,
  });
}

function bytesToLatin1(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    out += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return out;
}

function latin1ToBytes(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i) & 255;
  return bytes;
}

/** Drop the stray crest diagonals without redrawing the emblem. */
async function removeCrestDiagonals(pdf: PDFDocument) {
  const pdfLib = (await import("pdf-lib")) as unknown as {
    PDFName: { of(name: string): unknown };
    PDFRawStream: abstract new (...args: never[]) => {
      contents: Uint8Array;
      dict: { delete(key: unknown): boolean };
    };
    decodePDFRawStream(stream: unknown): { decode(): Uint8Array };
  };
  const page = pdf.getPages()[0];
  const contents = page.node.Contents();
  const refs = contents.asArray ? contents.asArray() : [contents];
  for (const ref of refs) {
    const obj = pdf.context.lookup(ref);
    if (!(obj instanceof pdfLib.PDFRawStream)) continue;
    const text = bytesToLatin1(pdfLib.decodePDFRawStream(obj).decode());
    const next = text.replace(CREST_DIAGONAL, "");
    if (next === text) continue;
    obj.contents = latin1ToBytes(next);
    obj.dict.delete(pdfLib.PDFName.of("Filter"));
    obj.dict.delete(pdfLib.PDFName.of("DecodeParms"));
  }
}

/**
 * The Word export kept the right red frame and dropped the left one.
 * A full-height stroke runs through the green bars and leaves a gap beside
 * the green line. This block fills only the gap between the green and blue
 * strokes, and it stops where those bars meet so the corner is square.
 */
const LEFT_FRAME: Record<
  CertificateKind,
  { x: number; y: number; w: number; h: number }
> = {
  askari: { x: 39.8, y: 30.1, w: 10, h: 712.3 },
  afisa: { x: 39.8, y: 38.9, w: 10, h: 713.5 },
};

/** Afisa's outer green corner stops one point short of the bottom bar. */
const AFISA_GREEN_CORNER = { x: 29.8, y: 28.8, w: 10, h: 10.1 };

function drawLeftFrame(page: PDFPage, kind: CertificateKind, red: RGB, green: RGB) {
  const frame = LEFT_FRAME[kind];
  page.drawRectangle({
    x: frame.x,
    y: frame.y,
    width: frame.w,
    height: frame.h,
    color: red,
    borderWidth: 0,
  });
  if (kind === "afisa") {
    page.drawRectangle({
      x: AFISA_GREEN_CORNER.x,
      y: AFISA_GREEN_CORNER.y,
      width: AFISA_GREEN_CORNER.w,
      height: AFISA_GREEN_CORNER.h,
      color: green,
      borderWidth: 0,
    });
  }
}

function isSignaturePaper(r: number, g: number, b: number, a: number) {
  if (a < 16) return true;
  return r > 242 && g > 242 && b > 242;
}

/** Drop the white scan margin so the ink fills the signature space. */
async function trimSignature(stamp: SignatureStamp): Promise<Uint8Array> {
  if (typeof document === "undefined" || typeof createImageBitmap !== "function") {
    return stamp.bytes;
  }
  const mime = stamp.kind === "png" ? "image/png" : "image/jpeg";
  const bitmap = await createImageBitmap(new Blob([stamp.bytes], { type: mime }));
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return stamp.bytes;
  ctx.drawImage(bitmap, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (isSignaturePaper(data[i], data[i + 1], data[i + 2], data[i + 3])) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < minX || maxY < minY) return stamp.bytes;
  const pad = 6;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);
  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;
  if (cropW > width * 0.98 && cropH > height * 0.98) return stamp.bytes;
  const out = document.createElement("canvas");
  out.width = cropW;
  out.height = cropH;
  const outCtx = out.getContext("2d");
  if (!outCtx) return stamp.bytes;
  outCtx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
  const png = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, "image/png"));
  if (!png) return stamp.bytes;
  return new Uint8Array(await png.arrayBuffer());
}

type SignatureImages = {
  chief: PDFImage | null;
  commandant: PDFImage | null;
};

type Palette = { ink: RGB; red: RGB; green: RGB };

async function loadPalette(): Promise<Palette> {
  const { rgb } = await import("pdf-lib");
  return {
    ink: rgb(0, 0, 0),
    red: rgb(1, 0, 0),
    green: rgb(0, 176 / 255, 80 / 255),
  };
}

function drawCertificateFields(
  page: PDFPage,
  font: PDFFont,
  data: CertificateData,
  signatures: SignatureImages,
  palette: Palette
) {
  const kind = certificateKind(data.rankAtEnrollment);
  const layout = layoutFor(kind);
  const { ink } = palette;

  drawInBox(page, font, formatArmyNumber(data.armyNumber), layout.army, 12, ink);
  drawInBox(page, font, certificateName(data.rankAtEnrollment), layout.rank, 12, ink);
  drawInBox(page, font, certificateName(data.fullName), layout.name, 12, ink);
  drawInBox(page, font, certificateName(data.courseName), layout.course, 13, ink);
  drawInBox(page, font, formatIntakeLabel(data.intakeNumber), layout.intake, 12, ink);
  drawInBox(page, font, certificateName(data.schoolNameSw), layout.school, 13, ink);

  const endDate = data.endDate ?? data.issueDate;
  drawInBox(page, font, formatCertDate(data.startDate), layout.from, 12, ink);
  drawInBox(page, font, formatCertDate(endDate), layout.to, 12, ink);

  const issue = formatCertDate(data.issueDate);
  drawInBox(page, font, issue, layout.dateLeft, 10, ink);
  drawInBox(page, font, issue, layout.dateRight, 10, ink);

  drawSignatory(page, layout.sigLeft, signatures.chief);
  drawSignatory(page, layout.sigRight, signatures.commandant);

  // The official askari file already has its left border. The afisa export
  // still drops that stroke, so only that page gets the repair.
  if (kind === "afisa") drawLeftFrame(page, kind, palette.red, palette.green);
}

export async function fillGraduationCertificate(
  templateBytes: ArrayBuffer | Uint8Array,
  fontBytes: ArrayBuffer | Uint8Array,
  data: CertificateData,
  stamps: { chief: SignatureStamp | null; commandant: SignatureStamp | null }
): Promise<Uint8Array> {
  const [{ PDFDocument }, fontkitMod, palette] = await Promise.all([
    import("pdf-lib"),
    import("@pdf-lib/fontkit"),
    loadPalette(),
  ]);

  const kind = certificateKind(data.rankAtEnrollment);
  const pdf = await PDFDocument.load(templateBytes);
  pdf.registerFontkit(fontkitMod.default);
  const font = await pdf.embedFont(fontBytes, { subset: true });
  await removeCrestDiagonals(pdf);

  const signatures: SignatureImages = {
    chief: await embedStamp(pdf, stamps.chief),
    commandant: await embedStamp(pdf, stamps.commandant),
  };
  drawCertificateFields(pdf.getPages()[0], font, data, signatures, palette);

  pdf.setTitle(`Certificate ${data.certificateNumber}`);
  pdf.setSubject(
    kind === "afisa"
      ? "Hati ya Kuhitimu Mafunzo ya Kijeshi — Afisa"
      : "Hati ya Kuhitimu Mafunzo ya Kijeshi — Askari"
  );
  return pdf.save();
}

async function embedStamp(
  pdf: PDFDocument,
  stamp: SignatureStamp | null
): Promise<PDFImage | null> {
  if (!stamp) return null;
  const trimmed = await trimSignature(stamp);
  return pdf.embedPng(trimmed).catch(async () =>
    stamp.kind === "png" ? pdf.embedPng(stamp.bytes) : pdf.embedJpg(stamp.bytes)
  );
}

function drawSignatory(page: PDFPage, box: Box, image: PDFImage | null) {
  if (!image) return;
  const maxW = box.w - 4;
  // Course dates sit about 50pt above this line. Use most of that gap.
  const maxH = 40;
  let width = maxW;
  let height = (image.height / image.width) * width;
  if (height > maxH) {
    height = maxH;
    width = (image.width / image.height) * height;
  }
  const x = box.x + (box.w - width) / 2;
  const y = box.y + 4;
  page.drawImage(image, { x, y, width, height });
}

async function loadStamp(
  path: string | null,
  origin: string
): Promise<SignatureStamp | null> {
  if (!path) return null;
  try {
    const url = path.startsWith("http") ? path : `${origin}${path}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    const type = (response.headers.get("content-type") || "").toLowerCase();
    const kind =
      type.includes("png") || path.toLowerCase().endsWith(".png") ? "png" : "jpg";
    return { bytes, kind };
  } catch {
    return null;
  }
}

async function fetchTemplate(kind: CertificateKind): Promise<ArrayBuffer> {
  const response = await fetch(`/certificates/${kind}.pdf`);
  if (!response.ok) throw new Error("Certificate template missing.");
  return response.arrayBuffer();
}

async function fetchCertificateFont(): Promise<ArrayBuffer> {
  const response = await fetch("/fonts/tahomabd.ttf");
  if (!response.ok) throw new Error("Certificate font missing.");
  return response.arrayBuffer();
}

function pdfBlob(bytes: Uint8Array): Blob {
  return new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function downloadGraduationCertificatePdf(
  data: CertificateData
): Promise<void> {
  const kind = certificateKind(data.rankAtEnrollment);
  const origin = window.location.origin;
  const [template, fontBytes, chief, commandant] = await Promise.all([
    fetchTemplate(kind),
    fetchCertificateFont(),
    loadStamp(data.chiefInstructor.signatureImagePath, origin),
    loadStamp(data.commandant.signatureImagePath, origin),
  ]);

  const bytes = await fillGraduationCertificate(template, fontBytes, data, {
    chief,
    commandant,
  });

  const safeArmy = data.armyNumber.replace(/\s+/g, "-");
  saveBlob(pdfBlob(bytes), `Certificate-${data.courseCode}-${safeArmy}.pdf`);
}

/**
 * One certificate per page, in list order. Each template is embedded once
 * and reused as the page background, so 50 certificates stay a small file.
 * Only page 1 of a template is used; page 2 is an empty Word overflow page.
 */
export async function buildGraduationCertificatesPdf(
  list: CertificateData[]
): Promise<Uint8Array> {
  const [{ PDFDocument }, fontkitMod, palette] = await Promise.all([
    import("pdf-lib"),
    import("@pdf-lib/fontkit"),
    loadPalette(),
  ]);
  const origin = window.location.origin;
  const kinds = [
    ...new Set(list.map((data) => certificateKind(data.rankAtEnrollment))),
  ];
  const stampPaths = [
    ...new Set(
      list
        .flatMap((data) => [
          data.chiefInstructor.signatureImagePath,
          data.commandant.signatureImagePath,
        ])
        .filter((path): path is string => Boolean(path))
    ),
  ];

  const [fontBytes, templates, stamps] = await Promise.all([
    fetchCertificateFont(),
    Promise.all(
      kinds.map(async (kind) => [kind, await fetchTemplate(kind)] as const)
    ),
    Promise.all(
      stampPaths.map(
        async (path) => [path, await loadStamp(path, origin)] as const
      )
    ),
  ]);

  const out = await PDFDocument.create();
  out.registerFontkit(fontkitMod.default);
  const font = await out.embedFont(fontBytes, { subset: true });

  const backgrounds = new Map<CertificateKind, PDFEmbeddedPage>();
  for (const [kind, bytes] of templates) {
    const template = await PDFDocument.load(bytes);
    await removeCrestDiagonals(template);
    const [background] = await out.embedPdf(template, [0]);
    backgrounds.set(kind, background);
  }

  const images = new Map<string, PDFImage | null>();
  for (const [path, stamp] of stamps) {
    images.set(path, await embedStamp(out, stamp));
  }
  const imageFor = (path: string | null) =>
    path ? (images.get(path) ?? null) : null;

  for (const data of list) {
    const background = backgrounds.get(certificateKind(data.rankAtEnrollment))!;
    const page = out.addPage([background.width, background.height]);
    page.drawPage(background);
    drawCertificateFields(
      page,
      font,
      data,
      {
        chief: imageFor(data.chiefInstructor.signatureImagePath),
        commandant: imageFor(data.commandant.signatureImagePath),
      },
      palette
    );
  }

  out.setTitle(`Certificates (${list.length})`);
  return out.save();
}

export async function downloadGraduationCertificatesPdf(
  list: CertificateData[],
  filename: string
): Promise<void> {
  const bytes = await buildGraduationCertificatesPdf(list);
  saveBlob(pdfBlob(bytes), filename);
}

let printFrame: { frame: HTMLIFrameElement; url: string } | null = null;

/**
 * Opens the browser print dialog for all certificates at once. The PDF is
 * loaded in an off-screen iframe; Chrome will not render (and so not print)
 * a PDF in a zero-size or display:none frame, hence the 1px box.
 */
export async function printGraduationCertificates(
  list: CertificateData[]
): Promise<void> {
  const bytes = await buildGraduationCertificatesPdf(list);
  const url = URL.createObjectURL(pdfBlob(bytes));

  if (printFrame) {
    printFrame.frame.remove();
    URL.revokeObjectURL(printFrame.url);
  }

  const frame = document.createElement("iframe");
  Object.assign(frame.style, {
    position: "fixed",
    right: "0",
    bottom: "0",
    width: "1px",
    height: "1px",
    border: "0",
    opacity: "0",
    pointerEvents: "none",
  });
  printFrame = { frame, url };

  await new Promise<void>((resolve) => {
    frame.onload = () => resolve();
    frame.src = url;
    document.body.appendChild(frame);
  });

  try {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
  } catch {
    window.open(url, "_blank");
  }
}
