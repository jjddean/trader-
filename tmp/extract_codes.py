"""Extract:
   - CDS error code descriptions from C:/Users/jason/AppData/Local/Temp/errcodes_ext/content.xml (.ods)
   - WCO References (Declaration) sheet from C:/Users/jason/AppData/Local/Temp/codelists_ext/xl/worksheets/sheet4.xml
     (this sheet maps DocumentSectionCode + TagID -> XML element + meaning)
"""
import xml.etree.ElementTree as ET
import re
import json

NS_X = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
NS_O = {
    'office': 'urn:oasis:names:tc:opendocument:xmlns:office:1.0',
    'table': 'urn:oasis:names:tc:opendocument:xmlns:table:1.0',
    'text': 'urn:oasis:names:tc:opendocument:xmlns:text:1.0',
}

# ---------- ODS ERROR CODES ----------
def extract_ods_rows(path):
    tree = ET.parse(path)
    root = tree.getroot()
    rows = []
    for row in root.iter('{urn:oasis:names:tc:opendocument:xmlns:table:1.0}table-row'):
        cells = []
        for cell in row.findall('table:table-cell', NS_O):
            repeat = int(cell.get('{urn:oasis:names:tc:opendocument:xmlns:table:1.0}number-columns-repeated', '1'))
            text_parts = [''.join(p.itertext()) for p in cell.findall('text:p', NS_O)]
            value = ' '.join(text_parts).strip()
            for _ in range(repeat):
                cells.append(value)
        # trim trailing empties
        while cells and cells[-1] == '':
            cells.pop()
        if cells:
            rows.append(cells)
    return rows

err_rows = extract_ods_rows('C:/Users/jason/AppData/Local/Temp/errcodes_ext/content.xml')
print('=== ERROR CODES — first row + sample ===')
print('Headers:', err_rows[0] if err_rows else 'none')
print('Total rows:', len(err_rows))
print()

# Build a lookup of validation code -> description
err_lookup = {}
header = err_rows[0] if err_rows else []
# Find the column indices for code and description
code_col = None
desc_col = None
for i, h in enumerate(header):
    hl = h.lower()
    if 'code' in hl and code_col is None:
        code_col = i
    if 'description' in hl or 'meaning' in hl:
        desc_col = i
        break
print(f'code col: {code_col}, desc col: {desc_col}')
print()

if code_col is not None:
    for row in err_rows[1:]:
        if len(row) > code_col:
            code = row[code_col].strip()
            desc = row[desc_col].strip() if (desc_col is not None and len(row) > desc_col) else ''
            if code and code.startswith('CDS'):
                err_lookup[code] = desc

# Print specific codes from the rejection
target_codes = ['CDS10001','CDS10002','CDS10004','CDS10020','CDS11004','CDS12005','CDS12056','CDS12070','CDS12071','CDS12073','CDS12075','CDS12077','CDS77002']
print('=== TARGET ERROR CODES ===')
for c in target_codes:
    print(f'{c}: {err_lookup.get(c, "(not found)")[:200]}')
print()

# ---------- CODELISTS WCO References ----------
ss_tree = ET.parse('C:/Users/jason/AppData/Local/Temp/codelists_ext/xl/sharedStrings.xml')
strings = []
for si in ss_tree.getroot().findall('s:si', NS_X):
    text_parts = [t.text or '' for t in si.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t')]
    strings.append(''.join(text_parts))

def cell_value(c):
    v = c.find('s:v', NS_X)
    if v is None:
        return ''
    if c.get('t') == 's':
        return strings[int(v.text)]
    return v.text or ''

def col_letter(ref):
    return ''.join(ch for ch in ref if ch.isalpha())

tree = ET.parse('C:/Users/jason/AppData/Local/Temp/codelists_ext/xl/worksheets/sheet4.xml')
root = tree.getroot()
print('=== WCO References (Declaration) - first 6 rows ===')
collected_rows = []
for row in root.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row'):
    rn = int(row.get('r'))
    cells = {col_letter(c.get('r')): cell_value(c) for c in row.findall('s:c', NS_X)}
    collected_rows.append((rn, cells))

for rn, cells in collected_rows[:8]:
    print(f'-- Row {rn} --')
    for k in sorted(cells.keys()):
        v = cells[k]
        if v:
            print(f'  [{k}]: {v[:150]}')
print()

# Now find rows containing the section codes from the rejection
target_sections = ['27A','17C','99B','64A','28A','16A','09B','74A','22B','42A','67A','68A','70A','41A','39B','79A','50A','30A','03A','02A','04A','05A','57A','57B','23A','21A']
target_tags = ['410','L110','R145','R144','R123','R038','R009','R050','R037','R004','166','164','161','188','122','112','103','241','239','245','228','226','465','D006','D031','360','090']

print('=== ROWS MENTIONING TARGET SECTION/TAG CODES ===')
matches_by_section = {s: [] for s in target_sections}
for rn, cells in collected_rows:
    if rn < 7:
        continue
    blob = ' || '.join(cells.values())
    for s in target_sections:
        if s in blob.split() or f'/{s}/' in blob or f'({s})' in blob or f'={s}' in blob:
            matches_by_section[s].append((rn, cells))

for s in target_sections:
    rows = matches_by_section[s]
    if rows:
        print(f'\n--- Section code "{s}" ({len(rows)} rows) — first 2 ---')
        for rn, cells in rows[:2]:
            for k in sorted(cells.keys()):
                v = cells[k]
                if v:
                    print(f'  [{rn}.{k}]: {v[:150]}')
            print()

print('\n=== ROWS MENTIONING TARGET TAG IDs ===')
for tag in target_tags:
    matched = []
    for rn, cells in collected_rows:
        if rn < 7:
            continue
        for k, v in cells.items():
            if v == tag or v.startswith(f'{tag} ') or v.endswith(f' {tag}'):
                matched.append((rn, cells))
                break
    if matched:
        print(f'\n--- Tag "{tag}" ({len(matched)} matches) — first 1 ---')
        for rn, cells in matched[:1]:
            for k in sorted(cells.keys()):
                v = cells[k]
                if v:
                    print(f'  [{rn}.{k}]: {v[:200]}')
