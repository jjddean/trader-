"""Comprehensive extraction of WCO References sheet — full table dump."""
import xml.etree.ElementTree as ET

NS_X = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

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
collected_rows = []
for row in root.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row'):
    rn = int(row.get('r'))
    cells = {col_letter(c.get('r')): cell_value(c) for c in row.findall('s:c', NS_X)}
    collected_rows.append((rn, cells))

# Build a section-code -> rows map
section_map = {}
tag_map = {}
for rn, cells in collected_rows:
    if rn < 7:
        continue
    name = cells.get('B', '').strip()
    code = cells.get('C', '').replace('\xa0', '').strip()  # non-breaking space sometimes
    path = cells.get('D', '').strip()
    fmt = cells.get('E', '').strip()
    remark = cells.get('H', '').strip()
    if not code:
        continue
    # Strip any unicode artifacts
    code_clean = code.replace(' ', '').strip()
    section_map.setdefault(code_clean, []).append({'row': rn, 'name': name, 'path': path, 'format': fmt, 'remark': remark})

# Print all distinct section codes with their paths (compact)
print('=== ALL SECTION CODE -> ELEMENT MAPPINGS ===')
for code in sorted(section_map.keys()):
    for entry in section_map[code]:
        print(f'  {code:>5} | {entry["path"]}')

# Now look for TagIDs — they typically appear in the "WCO id" column for individual fields
# but are sometimes embedded as numeric-only codes (e.g. 410, 122, 166).
# Extract all rows where column C is purely a 3-digit number or specific tag pattern.
print('\n=== POTENTIAL TAG ID ROWS (3-digit numeric in col C) ===')
target_tags = {'410','L110','R145','R144','R123','R038','R009','R050','R037','R004','166','164','161','188','122','112','103','241','239','245','228','226','465','090','410'}
shown = 0
for rn, cells in collected_rows:
    if rn < 7:
        continue
    code = cells.get('C', '').replace('\xa0', '').strip()
    if code in target_tags:
        name = cells.get('B', '').strip()
        path = cells.get('D', '').strip()
        fmt = cells.get('E', '').strip()
        remark = cells.get('H', '').strip()
        print(f'  Tag {code:>5} | {name} | {path} | {fmt[:30]}')
        shown += 1
        if shown > 60:
            break
