"""Targeted lookup of remaining section codes and tags from the rejection."""
import xml.etree.ElementTree as ET

NS_X = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

ss_tree = ET.parse('C:/Users/jason/AppData/Local/Temp/codelists_ext/xl/sharedStrings.xml')
strings = []
for si in ss_tree.getroot().findall('s:si', NS_X):
    text_parts = [t.text or '' for t in si.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t')]
    strings.append(''.join(text_parts))

def cell_value(c):
    v = c.find('s:v', NS_X)
    if v is None: return ''
    if c.get('t') == 's': return strings[int(v.text)]
    return v.text or ''

def col_letter(ref):
    return ''.join(ch for ch in ref if ch.isalpha())

tree = ET.parse('C:/Users/jason/AppData/Local/Temp/codelists_ext/xl/worksheets/sheet4.xml')
root = tree.getroot()

remaining_sections = ['67A','68A','70A','74A','41A','39B','50A','30A','79A','57A','57B']
remaining_tags = ['410','L110','R145','R144','R123','R038','R009','R050','R037','R004','245','465']

print('=== REMAINING SECTION CODES ===')
for row in root.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row'):
    rn = int(row.get('r'))
    if rn < 7: continue
    cells = {col_letter(c.get('r')): cell_value(c) for c in row.findall('s:c', NS_X)}
    code = cells.get('C', '').replace('\xa0','').replace(' ','').strip()
    if code in remaining_sections:
        path = cells.get('D', '').strip()
        name = cells.get('B', '').strip()
        print(f'  {code:>5} | {name[:40]:<40} | {path}')

print('\n=== REMAINING TAGS ===')
for row in root.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row'):
    rn = int(row.get('r'))
    if rn < 7: continue
    cells = {col_letter(c.get('r')): cell_value(c) for c in row.findall('s:c', NS_X)}
    code = cells.get('C', '').replace('\xa0','').replace(' ','').strip()
    if code in remaining_tags:
        path = cells.get('D', '').strip()
        name = cells.get('B', '').strip()
        fmt = cells.get('E', '').strip()
        remark = cells.get('H', '').strip()
        print(f'  Tag {code:>5} | {path} | {fmt[:30]} | {remark[:60]}')
