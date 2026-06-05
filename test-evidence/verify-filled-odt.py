import re
import zipfile

path = "documentation/HMRC/sdst-evidence-pack/forms/CDS-Production-Checklist-v1.2-FILLED.odt"
xml = zipfile.ZipFile(path).read("content.xml").decode()
out = []
for label in [
    "Submit a Customs Declaration",
    "Submit a cancellation request",
    "Get the status of a declaration by MRN",
]:
    i = xml.index(label)
    rs = xml.rfind("<table:table-row", 0, i)
    re_end = xml.index("</table:table-row>", i) + len("</table:table-row>")
    row = xml[rs:re_end]
    parts = row.split("<table:table-cell")[1:4]
    out.append(label)
    for n, part in enumerate(parts):
        text = re.sub(r"<[^>]+>", " ", part)
        text = " ".join(text.split())
        out.append(f"  col{n}: {text[:160]}")
    out.append("")

with open("documentation/HMRC/sdst-evidence-pack/forms/_verify.txt", "w", encoding="utf-8") as f:
    f.write("\n".join(out))
print("wrote _verify.txt")
