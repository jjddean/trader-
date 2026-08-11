import * as pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";

type MessagePdfEntry = {
  sender: string;
  createdAt: number;
  body: string;
};

let fontsReady = false;

function ensureFonts() {
  if (fontsReady) return;
  pdfMake.addVirtualFileSystem(pdfFonts);
  fontsReady = true;
}

export async function buildMessagePdf(args: {
  title: string;
  context?: string;
  entries: MessagePdfEntry[];
}): Promise<Blob> {
  ensureFonts();
  const content: Content[] = [
    { text: args.title, style: "title" },
    { text: args.context || "General enquiry", style: "context" },
  ];

  for (const entry of args.entries) {
    content.push(
      {
        text: `${entry.sender} - ${new Date(entry.createdAt).toLocaleString("en-GB")}`,
        style: "sender",
        margin: [0, 12, 0, 4],
      },
      { text: entry.body, style: "message" },
    );
  }

  const definition: TDocumentDefinitions = {
    content,
    defaultStyle: { font: "Roboto", fontSize: 10, lineHeight: 1.25 },
    styles: {
      title: { fontSize: 16, bold: true, margin: [0, 0, 0, 4] },
      context: { fontSize: 10, color: "#64748b", margin: [0, 0, 0, 8] },
      sender: { fontSize: 9, bold: true, color: "#475569" },
      message: { fontSize: 10, color: "#0f172a" },
    },
    pageMargins: [50, 45, 50, 45],
    info: { title: args.title, subject: args.context || "General enquiry" },
  };

  return pdfMake.createPdf(definition).getBlob();
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function messagePdfFileName(createdAt: number, prefix = "message") {
  return `${prefix}-${new Date(createdAt).toISOString().slice(0, 10)}.pdf`;
}
