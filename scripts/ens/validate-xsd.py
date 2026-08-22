"""Validate an XML document against an HMRC ENS schema.

Node has no XSD validator, and HMRC ships complete, compiling schemas for ENS —
unlike CDS, where the structural approximation in tests/h1/xsd-structure.test.ts
is the best available. Shelling out to lxml means the ENS tests assert against
the real schema rather than a reimplementation of it.

Usage:  python scripts/ens/validate-xsd.py <schema.xsd> <document.xml>
        python scripts/ens/validate-xsd.py --stdin <schema.xsd>

Exit 0 = valid. Exit 1 = invalid, with one error per line on stdout.
Exit 2 = could not run (missing file, lxml absent, schema will not compile).
"""
import sys

try:
    from lxml import etree
except ImportError:
    sys.stderr.write("lxml is required: pip install lxml\n")
    sys.exit(2)


def main(argv):
    if len(argv) >= 2 and argv[0] == "--stdin":
        schema_path = argv[1]
        data = sys.stdin.buffer.read()
    elif len(argv) >= 2:
        schema_path, doc_path = argv[0], argv[1]
        with open(doc_path, "rb") as fh:
            data = fh.read()
    else:
        sys.stderr.write(__doc__)
        return 2

    try:
        schema = etree.XMLSchema(etree.parse(schema_path))
    except Exception as exc:  # schema itself is broken or unreachable
        sys.stderr.write("schema did not compile: %s\n" % exc)
        return 2

    try:
        doc = etree.fromstring(data)
    except etree.XMLSyntaxError as exc:
        print("not well-formed XML: %s" % exc)
        return 1

    if schema.validate(doc):
        return 0

    for err in schema.error_log:
        print("line %s: %s" % (err.line, err.message))
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
