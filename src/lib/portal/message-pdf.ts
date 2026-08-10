type MessagePdfEntry = {
  sender: string;
  createdAt: number;
  body: string;
};

function ascii(value: string) {
  return value
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7E]/g, "?");
}

function wrap(value: string, width = 92): string[] {
  const output: string[] = [];
  for (const paragraph of value.replace(/\r\n/g, "\n").split("\n")) {
    if (!paragraph) {
      output.push("");
      continue;
    }
    let remaining = paragraph;
    while (remaining.length > width) {
      let split = remaining.lastIndexOf(" ", width);
      if (split < width / 2) split = width;
      output.push(remaining.slice(0, split));
      remaining = remaining.slice(split).trimStart();
    }
    output.push(remaining);
  }
  return output;
}

function escapePdf(value: string) {
  return ascii(value).replace(/([\\()])/g, "\\$1");
}

export function buildMessagePdf(args: {
  title: string;
  context?: string;
  entries: MessagePdfEntry[];
}): Blob {
  const lines = [args.title, args.context || "General enquiry", "", ...args.entries.flatMap((entry) => [
    `${entry.sender} - ${new Date(entry.createdAt).toLocaleString("en-GB")}`,
    ...wrap(entry.body),
    "",
  ])];
  const pages: string[][] = [];
  for (let index = 0; index < lines.length; index += 48) pages.push(lines.slice(index, index + 48));

  const objects: string[] = [];
  const pageIds: number[] = [];
  const contentIds: number[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  for (let index = 0; index < pages.length; index += 1) {
    pageIds.push(objects.length + 1);
    objects.push("");
    contentIds.push(objects.length + 1);
    const commands = pages[index]!.map((line, lineIndex) =>
      `BT /F1 ${lineIndex === 0 && index === 0 ? 14 : 10} Tf 50 ${790 - lineIndex * 15} Td (${escapePdf(line)}) Tj ET`,
    ).join("\n");
    objects.push(`<< /Length ${commands.length} >>\nstream\n${commands}\nendstream`);
  }
  objects[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  pageIds.forEach((pageId, index) => {
    objects[pageId - 1] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentIds[index]} 0 R >>`;
  });

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function messagePdfFileName(createdAt: number, prefix = "message") {
  return `${prefix}-${new Date(createdAt).toISOString().slice(0, 10)}.pdf`;
}
