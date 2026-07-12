# Generated export control datasets

Parsed JSON is produced from official sources — not committed to git.

```bash
# Control list (480 entries)
npm run export-controls:parse
npm run export-controls:upload

# UK Sanctions List (~12.5k designations, slim JSON)
npm run export-controls:ingest-sanctions
npm run export-controls:upload-sanctions

npm run test:export-controls
```

Sources:
- Control list PDF: `docs/export-controls/sources/uk_export_control_list_2025-12-16.pdf`
- Sanctions XML: `https://sanctionslist.fcdo.gov.uk/docs/UK-Sanctions-List.xml`

See `docs/export-controls/BUILD-PLAN.md` for update procedures.
