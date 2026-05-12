import xml.etree.ElementTree as ET
import sys

ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

BASE = r'C:\Users\jason\AppData\Local\Temp\tcm_extracted\xl'
ss_tree = ET.parse(BASE + r'\sharedStrings.xml')
strings = []
for si in ss_tree.getroot().findall('s:si', ns):
    text_parts = [t.text or '' for t in si.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t')]
    strings.append(''.join(text_parts))

tree = ET.parse(BASE + r'\worksheets\sheet2.xml')
root = tree.getroot()

def cell_value(c):
    v = c.find('s:v', ns)
    if v is None:
        return ''
    if c.get('t') == 's':
        return strings[int(v.text)]
    return v.text or ''

def col_letter(ref):
    return ''.join(ch for ch in ref if ch.isalpha())

def row_num(ref):
    return int(''.join(ch for ch in ref if ch.isdigit()))

# Print row 4 (header) and any rows whose A column or any cell mentions Representative or AuthorisationHolder
header = {}
for row in root.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row'):
    rn = int(row.get('r'))
    if rn == 4:
        for c in row.findall('s:c', ns):
            header[col_letter(c.get('r'))] = cell_value(c)
        print('=== HEADERS (row 4) ===')
        for k in sorted(header.keys()):
            print(f'  {k}: {header[k]}')
        print()

# Find rows mentioning Representative or AuthorisationHolder
print('=== ROWS MENTIONING Representative ===')
for row in root.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row'):
    rn = int(row.get('r'))
    if rn < 5:
        continue
    cells = {col_letter(c.get('r')): cell_value(c) for c in row.findall('s:c', ns)}
    blob = ' || '.join(cells.values()).lower()
    if 'representative' in blob or 'representation status' in blob:
        print(f'-- Row {rn} --')
        for k in sorted(cells.keys()):
            v = cells[k]
            if v:
                hdr = header.get(k, k)
                print(f'  [{k}] {hdr}: {v[:200]}')
        print()

print('=== ROWS MENTIONING AuthorisationHolder ===')
for row in root.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row'):
    rn = int(row.get('r'))
    if rn < 5:
        continue
    cells = {col_letter(c.get('r')): cell_value(c) for c in row.findall('s:c', ns)}
    blob = ' || '.join(cells.values()).lower()
    if 'authorisationholder' in blob.replace(' ', '') or 'holder of the authorisation' in blob or 'authorisation holder' in blob:
        print(f'-- Row {rn} --')
        for k in sorted(cells.keys()):
            v = cells[k]
            if v:
                hdr = header.get(k, k)
                print(f'  [{k}] {hdr}: {v[:200]}')
        print()
