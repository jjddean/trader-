/**
 * Fill CDS-Production-Checklist-v1.2.odt from SDST evidence pack data.
 * Output: documentation/HMRC/sdst-evidence-pack/forms/CDS-Production-Checklist-v1.2-FILLED.odt
 *
 * Run: node test-evidence/fill-cds-odt.js
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const FORMS = path.join(process.cwd(), "documentation/HMRC/sdst-evidence-pack/forms");
const SRC = path.join(FORMS, "CDS-Production-Checklist-v1.2.odt");
const WORK = path.join(FORMS, "odt-fill-work");
const OUT = path.join(FORMS, "CDS-Production-Checklist-v1.2-FILLED.odt");

const CLIENT = "b74874e9-957e-4a40-b426-0cde839f8a45";

function fillParagraph(styleName, value) {
  return `<text:p text:style-name="${styleName}"><text:span text:style-name="T16">${value}</text:span></text:p>`;
}

function escapeXml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function evidenceParagraphs(styleName, lines) {
  return lines
    .map(
      (line) =>
        `<text:p text:style-name="${styleName}"><text:span text:style-name="T182">${escapeXml(line)}</text:span></text:p>`,
    )
    .join("");
}

function replaceOnce(xml, search, replacement, label) {
  const idx = xml.indexOf(search);
  if (idx === -1) throw new Error(`Pattern not found: ${label}`);
  return xml.slice(0, idx) + replacement + xml.slice(idx + search.length);
}

function tickAfter(xml, anchor) {
  const idx = xml.indexOf(anchor);
  if (idx === -1) throw new Error(`Anchor not found: ${anchor}`);
  const boxIdx = xml.indexOf("☐", idx);
  if (boxIdx === -1) throw new Error(`Checkbox not found after: ${anchor}`);
  return xml.slice(0, boxIdx) + "☑" + xml.slice(boxIdx + 1);
}

/** Third table column only — not empty paragraphs in the endpoint description cell. */
function fillEvidenceColumn(xml, anchor, lines) {
  const idx = xml.indexOf(anchor);
  if (idx === -1) throw new Error(`Anchor not found: ${anchor}`);
  let marker = xml.indexOf("☑", idx);
  if (marker === -1) marker = xml.indexOf("☐", idx);
  if (marker === -1) throw new Error(`Checkbox not found after: ${anchor}`);
  const checkCellEnd = xml.indexOf("</table:table-cell>", marker);
  const evCellStart = xml.indexOf("<table:table-cell", checkCellEnd + 1);
  const evCellEnd = xml.indexOf("</table:table-cell>", evCellStart) + "</table:table-cell>".length;
  const cellInner = xml.slice(evCellStart, evCellEnd);
  const emptyMatch = cellInner.match(/<text:p text:style-name="(P\d+)"\/>/);
  if (!emptyMatch) throw new Error(`Evidence cell empty paragraph not found after: ${anchor}`);
  const filled = evidenceParagraphs(emptyMatch[1], lines);
  const newCellInner = cellInner.replace(emptyMatch[0], filled);
  return xml.slice(0, evCellStart) + newCellInner + xml.slice(evCellEnd);
}

if (fs.existsSync(WORK)) fs.rmSync(WORK, { recursive: true, force: true });
fs.mkdirSync(WORK, { recursive: true });
fs.copyFileSync(SRC, path.join(WORK, "src.zip"));
execSync(
  `powershell -Command "Expand-Archive -Path '${path.join(WORK, "src.zip")}' -DestinationPath '${path.join(WORK, "unzipped")}' -Force"`,
);

let xml = fs.readFileSync(path.join(WORK, "unzipped/content.xml"), "utf8");

// §1 — org name goes under the label, before the Section 1 header box (not in P8 below the box)
xml = replaceOnce(
  xml,
  'Organisation Name:</text:p><text:p text:style-name="Normal"><text:span text:style-name="T6">',
  `Organisation Name:</text:p>${fillParagraph("P8", "Freightcode")}<text:p text:style-name="Normal"><text:span text:style-name="T6">`,
  "Organisation",
);
xml = replaceOnce(
  xml,
  '<text:span text:style-name="T13">Sandbox Application Name:</text:span></text:p></text:list-item></text:list><text:p text:style-name="P14"/>',
  '<text:span text:style-name="T13">Sandbox Application Name:</text:span></text:p></text:list-item></text:list>' +
    fillParagraph("P14", "freightcode"),
  "Sandbox name",
);
xml = replaceOnce(
  xml,
  '<text:span text:style-name="T16">Sandbox Application ID:</text:span></text:p></text:list-item></text:list><text:p text:style-name="P17"/>',
  '<text:span text:style-name="T16">Sandbox Application ID:</text:span></text:p></text:list-item></text:list>' +
    fillParagraph("P17", CLIENT),
  "Sandbox ID",
);
xml = replaceOnce(
  xml,
  '<text:span text:style-name="T22">Production Application Name:</text:span></text:p></text:list-item></text:list><text:p text:style-name="P23"/>',
  '<text:span text:style-name="T22">Production Application Name:</text:span></text:p></text:list-item></text:list>' +
    fillParagraph("P23", "freightcode"),
  "Production name",
);
xml = replaceOnce(
  xml,
  '<text:span text:style-name="T31">:</text:span></text:p></text:list-item></text:list><text:p text:style-name="P32"/>',
  '<text:span text:style-name="T31">:</text:span></text:p></text:list-item></text:list>' +
    fillParagraph("P32", "Pending"),
  "Production ID",
);
xml = replaceOnce(
  xml,
  '<text:span text:style-name="T36">Premise Solution:</text:span></text:p></text:list-item></text:list><text:p text:style-name="P37"/>',
  '<text:span text:style-name="T36">Premise Solution:</text:span></text:p></text:list-item></text:list>' +
    fillParagraph("P37", "SaaS"),
  "SaaS",
);
xml = replaceOnce(
  xml,
  "Push or Pull Notifications:<text:s/></text:p></text:list-item></text:list><text:p text:style-name=\"P39\"/>",
  'Push or Pull Notifications:<text:s/></text:p></text:list-item></text:list>' + fillParagraph("P39", "Push"),
  "Push",
);
xml = replaceOnce(
  xml,
  "If using Push, please provide the<text:s/>Production<text:s/>callback URL/s:</text:p></text:list-item></text:list><text:p text:style-name=\"P41\"/>",
  'If using Push, please provide the<text:s/>Production<text:s/>callback URL/s:</text:p></text:list-item></text:list>' +
    fillParagraph("P41", "TBD production URL. Sandbox ngrok push webhook validated 2026-06-04"),
  "Callback",
);

// §2 — first checkbox after "3 rp" is 3 rps
const rateIdx = xml.indexOf("3 rp");
const firstBox = xml.indexOf("☐", rateIdx);
xml = xml.slice(0, firstBox) + "☑" + xml.slice(firstBox + 1);

// §3 — Declarations + Information
xml = tickAfter(xml, "Customs Declarations</text:p>");
xml = tickAfter(xml, "Customs Declarations Information");

// §4
const section4 = [
  [
    "Submit a Customs Declaration",
    [CLIENT, "26GB63M1I0RQFCVAR4", "FC-MPYAJ7RN", "2026-06-03T16:38:33Z", "68edb212-5c4a-4ef7-9223-f55630c5859e"],
  ],
  [
    "Submit a cancellation request",
    [CLIENT, "26GB656DZN0FE7LAR0", "FC-MPZUVPRD", "2026-06-04T18:56:06Z", "5a46d731-2020-4c95-810c-cc83b40d36a3"],
  ],
  [
    "Submit an upload initiate request",
    [CLIENT, "26GB664W3BLIFZFAR4", "—", "2026-06-05T13:47:40Z", "e8aba099-acee-438e-be25-2d4c713b9d99"],
  ],
  [
    "Submit a customs Amend Declaration",
    [CLIENT, "26GB664W3BLIFZFAR4", "FC-MQ0TDTJA", "2026-06-05T11:12:02Z", "01382a81-5000-408f-9c99-5215852f5758"],
  ],
];
for (const [label, lines] of section4) {
  xml = tickAfter(xml, label);
  xml = fillEvidenceColumn(xml, label, lines);
}

// §5.2 — MRN status only
xml = tickAfter(xml, "Get the status of a declaration by MRN");
xml = fillEvidenceColumn(xml, "Get the status of a declaration by MRN", [
  CLIENT,
  "26GB63M1I0RQFCVAR4",
  "2026-06-04T14:40:59Z",
  "2a9e80a9-1b65-4541-8077-73d2492357f4",
  "ICS 22",
]);

fs.writeFileSync(path.join(WORK, "unzipped/content.xml"), xml);

const unzipDir = path.join(WORK, "unzipped");
const packScript = path.join(process.cwd(), "test-evidence/package-odt.py");
execSync(`python "${packScript}" "${unzipDir}" "${OUT}"`, { stdio: "inherit" });
fs.rmSync(WORK, { recursive: true, force: true });

// Clean up leftover odt-fill from earlier attempt
const oldFill = path.join(FORMS, "odt-fill");
if (fs.existsSync(oldFill)) fs.rmSync(oldFill, { recursive: true, force: true });

console.log("Done:", OUT);
console.log("Open in LibreOffice and review all 5 pages before sending to SDST.");
