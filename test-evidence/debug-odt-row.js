const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const FORMS = path.join(process.cwd(), "docs/hmrc/ARCHIVE/trade-test/sdst-evidence-pack/forms");
const WORK = path.join(FORMS, "odt-debug");
if (fs.existsSync(WORK)) fs.rmSync(WORK, { recursive: true });
fs.mkdirSync(WORK, { recursive: true });
fs.copyFileSync(path.join(FORMS, "CDS-Production-Checklist-v1.2.odt"), path.join(WORK, "s.zip"));
execSync(
  `powershell -Command "Expand-Archive -Path '${path.join(WORK, "s.zip")}' -DestinationPath '${path.join(WORK, "u")}' -Force"`,
);

const xml = fs.readFileSync(path.join(WORK, "u/content.xml"), "utf8");
const label = "Submit a Customs Declaration";
const idx = xml.indexOf(label);
const marker = xml.indexOf("☐", idx);
const checkCellEnd = xml.indexOf("</table:table-cell>", marker);
const evCellStart = xml.indexOf("<table:table-cell", checkCellEnd + 1);
const evCellEnd = xml.indexOf("</table:table-cell>", evCellStart) + "</table:table-cell>".length;
console.log(xml.slice(evCellStart, evCellEnd));
