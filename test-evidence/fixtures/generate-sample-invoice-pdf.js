/**
 * Writes test-evidence/fixtures/sample-commercial-invoice.pdf
 * Minimal valid PDF for HMRC CDS secure upload (document type: invoice).
 */
const fs = require("fs");
const path = require("path");

const outPath = path.join(__dirname, "sample-commercial-invoice.pdf");

const pdf = Buffer.from(
  `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length 280>>stream
BT /F1 12 Tf 50 720 Td (COMMERCIAL INVOICE - TDR SANDBOX TEST) Tj 0 -24 Td (Invoice No: INV-FC-MQ8IDIYS) Tj 0 -18 Td (Seller: Acme Export GmbH, DE) Tj 0 -18 Td (Buyer EORI: GB553202734852) Tj 0 -18 Td (Goods: HS 8471300000 - Portable computers) Tj 0 -18 Td (Qty: 1  Value: GBP 5000.00) Tj 0 -18 Td (Document type for upload: invoice / N935) Tj ET
endstream
endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000266 00000 n
0000000600 00000 n
trailer<</Size 6/Root 1 0 R>>
startxref
679
%%EOF`,
  "utf8",
);

fs.writeFileSync(outPath, pdf);
console.log(`Wrote ${outPath} (${pdf.length} bytes)`);
