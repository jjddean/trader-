#!/usr/bin/env python3
"""Validate worker-json correction dataset before any training."""
from __future__ import annotations

import json
import sys
from pathlib import Path

REQUIRED_DIR = "lora-dataset-worker-json-v2"
REQUIRED_OUTPUT = "lora-output-worker-json-v2"
ALLOWED_CODES = {
    "6403519100", "6403519500", "6403519900",
    "6403919300", "6403919600", "6403919800",
    "6403999100", "6403999300", "6403999600", "6403999800",
}
REQUIRED_PAYLOAD_KEYS = {
    "correctHsCode",
    "confidence",
    "girsApplied",
    "complianceVerdict",
    "verdictReasoning",
    "officerExplanation",
}
LEGACY_PAYLOAD_KEYS = {"verdict", "girsUsed", "checks"}


def load_jsonl(path: Path):
    rows = []
    for i, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if line.strip():
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError as exc:
                raise AssertionError(f"{path}:{i} invalid JSONL: {exc}")
    return rows


def assistant_payload(row):
    msgs = row.get("messages", [])
    assert len(msgs) == 3, f"{row.get('id')} must have system/user/assistant messages"
    assert msgs[2].get("role") == "assistant", f"{row.get('id')} assistant message missing"
    try:
        return json.loads(msgs[2].get("content", ""))
    except json.JSONDecodeError as exc:
        raise AssertionError(f"{row.get('id')} assistant content is not JSON: {exc}")


def validate_row(row, split):
    rid = row.get("id")
    meta = row.get("metadata", {})
    assert meta.get("dataset") == REQUIRED_DIR, f"{rid} wrong dataset name"
    assert meta.get("split") == split, f"{rid} wrong split metadata"
    assert meta.get("review_status") == "reviewed", f"{rid} not reviewed"
    assert meta.get("topic") == "footwear_640351_vs_640399", f"{rid} wrong topic"
    assert meta.get("do_not_train") is (split == "locked-test"), f"{rid} do_not_train mismatch"

    payload = assistant_payload(row)
    keys = set(payload.keys())
    legacy = keys & LEGACY_PAYLOAD_KEYS
    assert not legacy, f"{rid} contains legacy payload keys: {sorted(legacy)}"
    missing = REQUIRED_PAYLOAD_KEYS - keys
    assert not missing, f"{rid} missing worker payload keys: {sorted(missing)}"
    extra = keys - REQUIRED_PAYLOAD_KEYS
    assert not extra, f"{rid} contains unexpected payload keys: {sorted(extra)}"

    code = payload.get("correctHsCode")
    assert payload.get("complianceVerdict") == "COMPLIANT", f"{rid} complianceVerdict must be COMPLIANT"
    assert isinstance(code, str) and code.isdigit() and len(code) == 10, f"{rid} bad code {code}"
    assert code in ALLOWED_CODES, f"{rid} unexpected footwear code {code}"
    confidence = payload.get("confidence")
    assert isinstance(confidence, (int, float)) and 0 <= confidence <= 1, f"{rid} bad confidence"
    girs = payload.get("girsApplied")
    assert isinstance(girs, list) and len(girs) == 2, f"{rid} GIRs must be exact"
    assert [g.get("rule") for g in girs] == ["GIR 1", "GIR 6"], f"{rid} GIR rules must be exact"
    for gir in girs:
        assert isinstance(gir.get("analysis"), str) and gir["analysis"], f"{rid} GIR analysis missing"
        assert isinstance(gir.get("conclusion"), str) and gir["conclusion"], f"{rid} GIR conclusion missing"
    reasoning = payload.get("verdictReasoning", "")
    assert "heading 6403" in reasoning, f"{rid} reasoning must mention heading 6403"
    assert code in reasoning, f"{rid} reasoning must mention correct code"
    exp = payload.get("officerExplanation", "")
    assert "heading 6403" in exp, f"{rid} explanation must mention heading 6403"
    assert code in exp, f"{rid} explanation must mention correct code"

    prompt = row["messages"][1]["content"].lower()
    combined_text = json.dumps(payload).lower()
    assert "rubber/plastics/composition leather" not in combined_text, f"{rid} uses overbroad sole evidence"
    if "composition leather" in combined_text:
        assert "composition leather" in prompt, f"{rid} mentions composition leather without prompt evidence"


def main():
    root = Path(sys.argv[1] if len(sys.argv) > 1 else REQUIRED_DIR)
    assert root.name == REQUIRED_DIR, f"dataset dir must be {REQUIRED_DIR}"
    paths = {
        "train": root / "train.jsonl",
        "eval": root / "eval.jsonl",
        "locked-test": root / "tests" / "locked-footwear.jsonl",
    }
    all_rows = {}
    for split, path in paths.items():
        assert path.exists(), f"missing {path}"
        rows = load_jsonl(path)
        assert rows, f"empty {path}"
        for row in rows:
            validate_row(row, split)
        all_rows[split] = rows

    train_eval_prompts = {r["messages"][1]["content"] for s in ["train", "eval"] for r in all_rows[s]}
    locked_prompts = {r["messages"][1]["content"] for r in all_rows["locked-test"]}
    overlap = train_eval_prompts & locked_prompts
    assert not overlap, f"locked tests overlap training/eval: {overlap}"
    assert 20 <= len(all_rows["locked-test"]) <= 50, "locked test count must be 20-50"

    print(json.dumps({
        "ok": True,
        "dataset": REQUIRED_DIR,
        "future_output_name": REQUIRED_OUTPUT,
        "counts": {k: len(v) for k, v in all_rows.items()},
    }, indent=2))

if __name__ == "__main__":
    main()


