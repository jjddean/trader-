"""Package a directory as a valid OpenDocument (.odt) file."""
import os
import sys
import zipfile


def pack_odt(source_dir: str, output_path: str) -> None:
    mimetype = os.path.join(source_dir, "mimetype")
    if not os.path.isfile(mimetype):
        raise FileNotFoundError(f"missing mimetype in {source_dir}")

    with zipfile.ZipFile(output_path, "w") as zf:
        zf.write(mimetype, "mimetype", compress_type=zipfile.ZIP_STORED)
        for root, _, files in os.walk(source_dir):
            for name in sorted(files):
                if name == "mimetype":
                    continue
                full = os.path.join(root, name)
                arcname = os.path.relpath(full, source_dir).replace("\\", "/")
                zf.write(full, arcname, compress_type=zipfile.ZIP_DEFLATED)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("usage: package-odt.py <source_dir> <output.odt>", file=sys.stderr)
        sys.exit(1)
    pack_odt(sys.argv[1], sys.argv[2])
    print(f"packed {sys.argv[2]}")
