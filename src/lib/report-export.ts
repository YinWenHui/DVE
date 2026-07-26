export interface ReportPageCapture {
  pageName: string;
  dataUrl: string;
  width: number;
  height: number;
}

export function exportFileName(reportSlug: string, pageName: string, extension: string): string {
  const suffix = pageName.toLocaleLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replaceAll(/^-|-$/g, "");
  return `${reportSlug}-${suffix || "page"}.${extension}`;
}

export function containRect(sourceWidth: number, sourceHeight: number, targetWidth: number, targetHeight: number) {
  const scale = Math.min(targetWidth / Math.max(1, sourceWidth), targetHeight / Math.max(1, sourceHeight));
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return { x: (targetWidth - width) / 2, y: (targetHeight - height) / 2, width, height };
}

export async function captureReportCanvas(element: HTMLElement): Promise<Omit<ReportPageCapture, "pageName">> {
  const { toPng } = await import("html-to-image");
  const width = Math.max(element.scrollWidth, element.clientWidth);
  const height = Math.max(element.scrollHeight, element.clientHeight);
  const dataUrl = await toPng(element, {
    backgroundColor: getComputedStyle(element).backgroundColor || "#ffffff",
    height,
    width,
    pixelRatio: 2,
  });
  return { dataUrl, width, height };
}

export async function downloadReportImage(capture: ReportPageCapture, reportSlug: string) {
  const blob = await (await fetch(capture.dataUrl)).blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = exportFileName(reportSlug, capture.pageName, "png");
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5_000);
}

export async function downloadReportPdf(captures: ReportPageCapture[], reportSlug: string) {
  const { jsPDF } = await import("jspdf");
  let pdf: InstanceType<typeof jsPDF> | undefined;
  captures.forEach((capture, index) => {
    const orientation = capture.width >= capture.height ? "landscape" : "portrait";
    if (!pdf) pdf = new jsPDF({ orientation, unit: "pt", format: "a4", compress: true });
    else pdf.addPage("a4", orientation);
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const frame = containRect(capture.width, capture.height, pageWidth - 36, pageHeight - 54);
    pdf.setFontSize(10);
    pdf.text(capture.pageName, 18, 18);
    pdf.addImage(capture.dataUrl, "PNG", frame.x + 18, frame.y + 32, frame.width, frame.height, undefined, "FAST");
    if (index === captures.length - 1) pdf.save(`${reportSlug}.pdf`);
  });
}

export async function downloadReportPowerPoint(captures: ReportPageCapture[], reportName: string, reportSlug: string) {
  const { default: JSZip } = await import("jszip");
  (globalThis as typeof globalThis & { JSZip?: typeof JSZip }).JSZip = JSZip;
  const { default: PptxGenJS } = await import("pptxgenjs");
  const deck = new PptxGenJS();
  deck.layout = "LAYOUT_WIDE";
  deck.author = "Digital Verse";
  deck.subject = reportName;
  deck.title = reportName;
  deck.company = "Digital Verse";
  captures.forEach((capture) => {
    const slide = deck.addSlide();
    slide.background = { color: "F5F7FB" };
    slide.addText(`${reportName} — ${capture.pageName}`, { x: 0.35, y: 0.15, w: 12.63, h: 0.35, fontFace: "Arial", fontSize: 17, bold: true, color: "172033", margin: 0 });
    const frame = containRect(capture.width, capture.height, 12.63, 6.72);
    slide.addImage({ data: capture.dataUrl, x: frame.x + 0.35, y: frame.y + 0.62, w: frame.width, h: frame.height });
  });
  await deck.writeFile({ fileName: `${reportSlug}.pptx` });
}
