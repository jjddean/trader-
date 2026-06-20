# HMRC secure upload — sample documents

For **Connect HMRC → Declaration with MRN → Documents → Secure Upload**.

## What HMRC expects (sandbox)

| Field | Value |
|-------|--------|
| **File format** | PDF (recommended), JPG, PNG — small file (&lt; 10 MB) |
| **Document type** (API) | `invoice` (default) — commercial invoice / N935 evidence |
| **Content** | Sandbox does **not** validate invoice layout; any valid PDF bytes work |
| **MRN** | Upload must target the declaration’s **MRN** (already on the page) |

Other API document types exist in HMRC CDS guides; for your lane use **`invoice`**.

## Files here

| File | Use |
|------|-----|
| `sample-commercial-invoice.pdf` | Ready to upload — minimal PDF with lane text (FC-MQ8IDIYS, GBP 5000, HS 8471300000) |
| `sample-commercial-invoice.html` | Open in browser → **Print → Save as PDF** for a nicer one-page invoice |

## Quick test

1. Declaration with MRN (e.g. `26GB6DTVT5133M7AR0`)
2. Upload `sample-commercial-invoice.pdf`
3. Success = no error + file listed under “Previously Uploaded to HMRC”

Regenerate PDF: `node test-evidence/fixtures/generate-sample-invoice-pdf.js`
