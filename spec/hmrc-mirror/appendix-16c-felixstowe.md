# Appendix 16C — Felixstowe row

| | |
|--|--|
| Source ODS | `appendix-16c-maritime.ods` (Length: 24920 bytes) |
| ODS published | 2026-05-18 (per gov.uk page header) |
| Extracted | 2026-05-27 |

## Verbatim row

ODS table column headers:

| Column | Header |
|--------|--------|
| 1 | Name |
| 2 | Address |
| 3 | Location Code |
| 4 | Northern Ireland Location (Yes or No) |

Felixstowe row:

| Column 1 (Name) | Column 2 (Address) | Column 3 (Location Code) | Column 4 (NI) |
|-----------------|--------------------|--------------------------|---------------|
| Felixstowe Dock & Railway Company T/A Port of Felixstowe | (empty) | **`GBAUFXTFXTFXT`** | No |

## Source-conflict note

The Group 5 completion guide says:

> The Codes shown in column 2 of Appendices 16 DE 5/23: Goods Location Codes (with the exclusion of Appendix 16I) are the consolidated location codes to be declared in DE 5/23.

That refers to a previous table layout. The 2026-05-18 ODS has the Location Code in **column 3** (column 2 is Address). The Appendix 16C update note for 28 March 2026 confirms:

> The data list's content and structure have been updated.

Resolution: the **column 3** in the current ODS is authoritative.

## Implication for current code

The repo and prior submissions used `GBAUFXTFXTGW`. **This string does not appear anywhere in the current Appendix 16C ODS.** The correct code is `GBAUFXTFXTFXT`.

Other matches for `FXT` in the ODS:

```powershell
Select-String -Path content.xml -Pattern "FXT|Felixstowe"
# → GBAUFXTFXTFXT
```

No other Felixstowe code exists.

## Verification command

```powershell
cd spec\hmrc-mirror
$content = Get-Content appendix-16c-extracted\content.xml -Raw
Select-String -Path appendix-16c-maritime.psv -Pattern "Felixstowe"
```

Expected output:

```
Felixstowe Dock & Railway Company T/A Port of Felixstowe|GBAUFXTFXTFXT|No
```
