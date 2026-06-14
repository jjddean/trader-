#!/usr/bin/env python3
"""Convert generate-training-data.mjs CSV (JSON lines) → plain text column for AutoTrain."""

from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "lora-dataset" / "train.csv"
DST = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / "lora-dataset" / "train-autotrain.csv"


def load_rows(path: Path) -> list[str]:
    texts: list[str] = []
    with path.open(encoding="utf-8") as handle:
        for i, raw in enumerate(handle):
            line = raw.strip()
            if not line:
                continue
            if i == 0 and line == "text":
                continue
            row = json.loads(line)
            text = row.get("text")
            if not isinstance(text, str):
                raise ValueError(f"Row {i + 1}: missing text")
            texts.append(text)
    return texts


def main() -> None:
    texts = load_rows(SRC)
    DST.parent.mkdir(parents=True, exist_ok=True)
    with DST.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["text"])
        for text in texts:
            writer.writerow([text])
    print(f"Wrote {len(texts)} rows -> {DST}")


if __name__ == "__main__":
    main()
