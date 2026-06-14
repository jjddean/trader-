#!/usr/bin/env python3
"""
Validate LoRA train.csv (JSON-per-line, single text column).

Usage:
  python scripts/lora/validate_dataset.py
  python scripts/lora/validate_dataset.py lora-dataset/train.csv
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEFAULT = ROOT / "lora-dataset" / "train.csv"

CORRUPT_PROMPT = re.compile(r"without\s+\.\s+\d+\s+reasoning|without\s+\d{4}\s+reasoning")
REQUIRED_OUTPUT = ("HS_CODE:", "CONFIDENCE:", "GIR:", "REPRESENTATION:", "INDIRECT_REQUIRED:", "RISK_LEVEL:", "REASON:")


def validate_file(path: Path) -> int:
    if not path.is_file():
        raise SystemExit(f"Missing {path}")

    errors: list[str] = []
    rows = 0

    with path.open(encoding="utf-8") as handle:
        for line_no, raw in enumerate(handle, start=1):
            line = raw.strip()
            if not line:
                continue
            if line_no == 1 and line == "text":
                continue

            rows += 1
            try:
                row = json.loads(line)
            except json.JSONDecodeError as exc:
                errors.append(f"line {line_no}: invalid JSON ({exc})")
                continue

            if set(row.keys()) != {"text"}:
                errors.append(f"line {line_no}: expected single key 'text', got {list(row.keys())}")
                continue

            text = row.get("text")
            if not isinstance(text, str) or not text.strip():
                errors.append(f"line {line_no}: empty or non-string text")
                continue

            if "[INST]" not in text or "[/INST]" not in text:
                errors.append(f"line {line_no}: missing [INST] or [/INST]")
            if text.index("[/INST]") < text.index("[INST]"):
                errors.append(f"line {line_no}: [/INST] before [INST]")
            if CORRUPT_PROMPT.search(text):
                errors.append(f"line {line_no}: corrupt 'without reasoning' prompt")
            for field in REQUIRED_OUTPUT:
                if field not in text.split("[/INST]", 1)[-1]:
                    errors.append(f"line {line_no}: missing {field} in output")
                    break

    print(f"File: {path}")
    print(f"Rows: {rows}")
    if errors:
        print(f"FAIL — {len(errors)} issue(s):")
        for err in errors[:20]:
            print(f"  {err}")
        if len(errors) > 20:
            print(f"  ... and {len(errors) - 20} more")
        return 1

    print("OK — all rows have [INST], [/INST], JSON wrapper, and required output fields")
    return 0


def main() -> None:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT
    raise SystemExit(validate_file(path))


if __name__ == "__main__":
    main()
