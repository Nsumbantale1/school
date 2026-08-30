import type { CertificateData } from "./certificate-data";

function formatCertDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  const day = String(date.getDate()).padStart(2, "0");
  const month = date.toLocaleDateString("en-GB", { month: "short" });
  const year = String(date.getFullYear()).slice(-2);
  return `${day} ${month} ${year}`;
}

function formatIntakeLabel(intakeNumber: string): string {
  const trimmed = intakeNumber.trim();
  if (/^int[-\s]/i.test(trimmed)) return trimmed;
  return `Int- ${trimmed}`;
}

function formatArmyNumber(armyNumber: string): string {
  const trimmed = armyNumber.trim();
  const match = trimmed.match(/^([A-Za-z]+)\s*(.+)$/);
  if (match) return `${match[1].toUpperCase()} ${match[2]}`;
  return trimmed.toUpperCase();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function signatureBlock(
  signatory: CertificateData["chiefInstructor"],
  titleSw: string,
  titleEn: string,
  issueDate: string,
  origin: string
): string {
  const sigImg = signatory.signatureImagePath
    ? `<img src="${origin}${signatory.signatureImagePath}" alt="" class="sig-img" />`
    : "";
  const rank = signatory.rankTitle
    ? `<div class="sig-rank">${escapeHtml(signatory.rankTitle)}</div>`
    : "";

  return `
    <div class="sig-block">
      <div class="sig-top">
        ${sigImg}
        ${rank}
        <div class="sig-line"></div>
      </div>
      <div class="sig-title">
        <div class="sw">${titleSw}</div>
        <div class="en">${titleEn}</div>
      </div>
      <div class="sig-date">
        <div class="sig-date-label">
          <span class="sw">Tarehe</span>
          <span class="en">Date</span>
        </div>
        <div class="field-line narrow"><span class="value">${escapeHtml(issueDate)}</span></div>
      </div>
    </div>
  `;
}

export function buildCertificateHtml(
  data: CertificateData,
  origin: string
): string {
  const endDate = data.endDate ?? data.issueDate;
  const issueDateStr = formatCertDate(data.issueDate);

  return `<!DOCTYPE html>
<html lang="sw">
<head>
  <meta charset="UTF-8" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=UnifrakturMaguntia&family=Times+New+Roman:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: 210mm;
      height: 297mm;
      background: #fff;
      font-family: "Times New Roman", Times, serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page {
      position: relative;
      width: 210mm;
      height: 297mm;
      padding: 7mm;
      overflow: hidden;
      background: #fff;
    }
    .frame-green {
      position: absolute;
      inset: 7mm;
      border: 2.4mm solid #008837;
      pointer-events: none;
    }
    .frame-red {
      position: absolute;
      inset: 9.5mm;
      border: 0.7mm solid #c40f14;
      pointer-events: none;
    }
    .frame-blue {
      position: absolute;
      inset: 11mm;
      border: 0.55mm solid #004ba5;
      pointer-events: none;
    }
    .frame-inner {
      position: absolute;
      inset: 17mm;
      border: 0.25mm solid #a8c4dc;
      pointer-events: none;
    }
    .watermark {
      position: absolute;
      left: 50%;
      top: 52%;
      transform: translate(-50%, -50%);
      width: 95mm;
      opacity: 0.07;
      pointer-events: none;
    }
    .content {
      position: relative;
      z-index: 1;
      padding: 4mm 12mm 8mm;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .header-svg {
      width: 170mm;
      height: 22mm;
      margin-top: 1mm;
    }
    .header-svg text {
      fill: #c40f14;
      font-family: Arial, Helvetica, sans-serif;
      font-weight: 700;
      font-size: 11px;
      letter-spacing: 0.4px;
    }
    .tpdf-line {
      color: #c40f14;
      font-family: Arial, Helvetica, sans-serif;
      font-weight: 700;
      font-size: 8.5pt;
      letter-spacing: 0.3px;
      margin-top: 1mm;
      text-align: center;
    }
    .crest {
      width: 27mm;
      height: auto;
      margin: 2mm auto 1mm;
      display: block;
    }
    .title-gothic {
      font-family: "UnifrakturMaguntia", "Old English Text MT", serif;
      color: #c40f14;
      font-size: 20pt;
      text-align: center;
      line-height: 1.1;
      margin-top: 1mm;
    }
    .title-en {
      color: #c40f14;
      font-weight: 700;
      font-size: 13pt;
      text-align: center;
      margin-top: 1.5mm;
    }
    .certify-sw {
      font-family: "UnifrakturMaguntia", "Old English Text MT", serif;
      color: #c40f14;
      font-size: 15pt;
      text-align: center;
      margin-top: 4mm;
    }
    .certify-en {
      color: #c40f14;
      font-size: 10pt;
      text-align: center;
      margin-top: 1mm;
    }
    .row-3 {
      width: 100%;
      display: grid;
      grid-template-columns: 1fr 1fr 1.6fr;
      gap: 4mm;
      margin-top: 7mm;
    }
    .field-group { text-align: center; }
    .label-sw {
      color: #c40f14;
      font-weight: 700;
      font-size: 10pt;
      line-height: 1.1;
    }
    .field-line {
      border-bottom: 1px dotted #555;
      min-height: 7mm;
      margin-top: 1mm;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      padding-bottom: 0.5mm;
    }
    .field-line .value {
      font-family: Arial, Helvetica, sans-serif;
      font-weight: 700;
      font-size: 11pt;
      color: #000;
      transform: translateY(1mm);
    }
    .label-en {
      color: #c40f14;
      font-size: 8pt;
      margin-top: 1mm;
    }
    .section-text {
      text-align: center;
      margin-top: 5mm;
      color: #c40f14;
    }
    .section-text .sw {
      font-weight: 700;
      font-size: 10pt;
      line-height: 1.2;
    }
    .section-text .en {
      font-size: 8.5pt;
      line-height: 1.2;
    }
    .field-wide {
      width: 88%;
      margin: 3mm auto 0;
    }
    .field-mid {
      width: 52%;
      margin: 2.5mm auto 0;
    }
    .row-dates {
      width: 78%;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10mm;
      margin-top: 5mm;
    }
    .signatures {
      width: 92%;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8mm;
      margin-top: auto;
      padding-bottom: 6mm;
    }
    .sig-block { text-align: center; }
    .sig-top {
      min-height: 18mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-end;
    }
    .sig-img {
      max-width: 38mm;
      max-height: 12mm;
      object-fit: contain;
      margin-bottom: 1mm;
    }
    .sig-rank {
      font-family: Arial, Helvetica, sans-serif;
      font-weight: 700;
      font-style: italic;
      font-size: 10pt;
      margin-bottom: 1mm;
    }
    .sig-line {
      width: 48mm;
      border-bottom: 1px dotted #555;
      height: 1px;
    }
    .sig-title {
      margin-top: 2mm;
      color: #c40f14;
    }
    .sig-title .sw {
      font-weight: 700;
      font-size: 9.5pt;
      line-height: 1.1;
    }
    .sig-title .en {
      font-size: 8pt;
      line-height: 1.1;
    }
    .sig-date {
      display: flex;
      align-items: flex-end;
      justify-content: center;
      gap: 2mm;
      margin-top: 3mm;
    }
    .sig-date-label {
      text-align: right;
      color: #c40f14;
      min-width: 14mm;
    }
    .sig-date-label .sw {
      display: block;
      font-weight: 700;
      font-size: 8.5pt;
      line-height: 1.1;
    }
    .sig-date-label .en {
      display: block;
      font-size: 7pt;
      line-height: 1.1;
    }
    .field-line.narrow {
      width: 24mm;
      min-height: 5mm;
    }
  </style>
</head>
<body>
  <div class="page" id="certificate-root">
    <div class="frame-green"></div>
    <div class="frame-red"></div>
    <div class="frame-blue"></div>
    <div class="frame-inner"></div>
    <img class="watermark" src="${origin}/tpdf-crest.png" alt="" />
    <div class="content">
      <svg class="header-svg" viewBox="0 0 640 70" aria-hidden="true">
        <defs>
          <path id="headerArc" d="M 40,58 A 280,120 0 0,1 600,58" fill="none" />
        </defs>
        <text>
          <textPath href="#headerArc" startOffset="50%" text-anchor="middle">
            JESHI LA ULINZI LA WANANCHI WA TANZANIA
          </textPath>
        </text>
      </svg>
      <div class="tpdf-line">TANZANIA PEOPLES DEFENCE FORCES</div>
      <img class="crest" src="${origin}/tpdf-crest.png" alt="" />
      <div class="title-gothic">Hati ya Kuhitimu Mafunzo ya Kijeshi</div>
      <div class="title-en">Military Training Graduation Certificate</div>
      <div class="certify-sw">Hii ni kuthibitisha kuwa</div>
      <div class="certify-en">This is to certify that</div>

      <div class="row-3">
        <div class="field-group">
          <div class="label-sw">Nambari</div>
          <div class="field-line"><span class="value">${escapeHtml(formatArmyNumber(data.armyNumber))}</span></div>
          <div class="label-en">No.</div>
        </div>
        <div class="field-group">
          <div class="label-sw">Cheo</div>
          <div class="field-line"><span class="value">${escapeHtml(data.rankAtEnrollment)}</span></div>
          <div class="label-en">Rank</div>
        </div>
        <div class="field-group">
          <div class="label-sw">Jina Kamili</div>
          <div class="field-line"><span class="value">${escapeHtml(data.fullName)}</span></div>
          <div class="label-en">Name in full</div>
        </div>
      </div>

      <div class="section-text">
        <div class="sw">Amehudhuria na kufaulu mafunzo ya</div>
        <div class="en">Has attended and successfully completed the course of</div>
      </div>
      <div class="field-line field-wide"><span class="value">${escapeHtml(data.courseName)}</span></div>
      <div class="field-line field-mid"><span class="value">${escapeHtml(formatIntakeLabel(data.intakeNumber))}</span></div>

      <div class="section-text">
        <div class="sw">Yaliyoendeshwa</div>
        <div class="en">Which was conducted at</div>
      </div>
      <div class="field-line field-wide"><span class="value">${escapeHtml(data.schoolNameSw)}</span></div>

      <div class="row-dates">
        <div class="field-group">
          <div class="label-sw">Kuanzia</div>
          <div class="field-line"><span class="value">${escapeHtml(formatCertDate(data.startDate))}</span></div>
          <div class="label-en">From</div>
        </div>
        <div class="field-group">
          <div class="label-sw">Hadi</div>
          <div class="field-line"><span class="value">${escapeHtml(formatCertDate(endDate))}</span></div>
          <div class="label-en">To</div>
        </div>
      </div>

      <div class="signatures">
        ${signatureBlock(data.chiefInstructor, "Mkufunzi Mkuu", "Chief Instructor", issueDateStr, origin)}
        ${signatureBlock(data.commandant, "Mkuu wa Chuo/Shule", "Commandant", issueDateStr, origin)}
      </div>
    </div>
  </div>
</body>
</html>`;
}
