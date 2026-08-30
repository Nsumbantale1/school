import type { CertificateData } from "./certificate-data";
import { buildCertificateHtml } from "./certificate-template-html";

async function waitForImages(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.onload = () => resolve();
          img.onerror = () => resolve();
        })
    )
  );
  await new Promise((resolve) => setTimeout(resolve, 400));
}

export async function downloadGraduationCertificatePdf(
  data: CertificateData
): Promise<void> {
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import("jspdf"),
    import("html2canvas"),
  ]);

  const origin = window.location.origin;
  const html = buildCertificateHtml(data, origin);

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.left = "-10000px";
  iframe.style.top = "0";
  iframe.style.width = "210mm";
  iframe.style.height = "297mm";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!iframeDoc) {
    document.body.removeChild(iframe);
    throw new Error("Could not render certificate.");
  }

  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();

  try {
    const root = iframeDoc.getElementById("certificate-root");
    if (!root) throw new Error("Certificate template missing.");

    await waitForImages(root);

    const canvas = await html2canvas(root, {
      scale: 3,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      width: root.offsetWidth,
      height: root.offsetHeight,
    });

    const imgData = canvas.toDataURL("image/png");
    const doc = new jsPDF({
      unit: "mm",
      format: "a4",
      orientation: "portrait",
      compress: true,
    });

    doc.addImage(imgData, "PNG", 0, 0, 210, 297, undefined, "FAST");

    const safeArmy = data.armyNumber.replace(/\s+/g, "-");
    doc.save(`Certificate-${data.courseCode}-${safeArmy}.pdf`);
  } finally {
    document.body.removeChild(iframe);
  }
}
