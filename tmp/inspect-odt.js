const fs = require("fs");
const { execSync } = require("child_process");
const path = require("path");

const odt = path.join(
  process.cwd(),
  "documentation/HMRC/sdst-evidence-pack/forms/CDS-Production-Checklist-v1.2-FILLED.odt",
);
const work = path.join(process.cwd(), "tmp/odt-check");
fs.mkdirSync(path.join(work, "unz"), { recursive: true });
fs.copyFileSync(odt, path.join(work, "f.zip"));
execSync(
  `powershell -Command "Expand-Archive -Path '${path.join(work, "f.zip")}' -DestinationPath '${path.join(work, "unz")}' -Force"`,
);
const xml = fs.readFileSync(path.join(work, "unz/content.xml"), "utf8");
const keys = [
  "Freightcode",
  "b74874e9",
  "Pending",
  "SaaS",
  "Push",
  "26GB664W3BLIFZFAR4",
  "26GB63M1I0RQFCVAR4",
  "26GB656DZN0FE7LAR0",
  "e8aba099",
  "ngrok",
  "freightcode.co.uk",
  "TBD production",
  "Get the status of a declaration by MRN",
];
for (const k of keys) {
  console.log(`${k}: ${xml.includes(k) ? "YES" : "NO"}`);
}
console.log("checkbox ticks (☑):", (xml.match(/☑/g) || []).length);
