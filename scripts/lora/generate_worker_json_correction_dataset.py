#!/usr/bin/env python3
"""Generate reviewed worker-json correction dataset for v3.

Scope: footwear failures only. No training is run here.
Output directory is intentionally locked to: lora-dataset-worker-json-v2
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict, Iterable, List

OUTPUT_DIR_NAME = "lora-dataset-worker-json-v2"

CASES: List[Dict[str, Any]] = [
    # TRAIN: 640351 vs 640399 core failures
    {"id":"fw-train-001","split":"train","product":"women's ankle boot, leather upper, leather outer sole, insole 25 cm","code":"6403519900","sex":"women","sole":"leather","covers_ankle":True},
    {"id":"fw-train-002","split":"train","product":"men's ankle boot, leather upper, leather outer sole, insole 27 cm","code":"6403519500","sex":"men","sole":"leather","covers_ankle":True},
    {"id":"fw-train-003","split":"train","product":"women's leather ankle boots with leather soles, size 39","code":"6403519900","sex":"women","sole":"leather","covers_ankle":True},
    {"id":"fw-train-004","split":"train","product":"men's leather ankle boots with full leather outer sole","code":"6403519500","sex":"men","sole":"leather","covers_ankle":True},
    {"id":"fw-train-005","split":"train","product":"women's leather upper ankle boots with rubber outer sole","code":"6403919800","sex":"women","sole":"rubber/plastics","covers_ankle":True},
    {"id":"fw-train-006","split":"train","product":"men's leather upper ankle boots with rubber sole, not safety footwear","code":"6403919600","sex":"men","sole":"rubber/plastics","covers_ankle":True},
    {"id":"fw-train-007","split":"train","product":"women's leather dress shoes, leather uppers, rubber outer soles, not ankle boots","code":"6403999800","sex":"women","sole":"rubber/plastics","covers_ankle":False},
    {"id":"fw-train-008","split":"train","product":"men's leather dress shoes with rubber soles, not covering ankle","code":"6403999600","sex":"men","sole":"rubber/plastics","covers_ankle":False},
    {"id":"fw-train-009","split":"train","product":"women's court shoes, leather upper, plastic outer sole","code":"6403999800","sex":"women","sole":"rubber/plastics","covers_ankle":False},
    {"id":"fw-train-010","split":"train","product":"men's formal leather shoes with synthetic rubber outsole","code":"6403999600","sex":"men","sole":"rubber/plastics","covers_ankle":False},
    {"id":"fw-train-011","split":"train","product":"children's leather upper shoes, rubber outer sole, insole 22 cm","code":"6403999100","sex":"child/less than 24 cm","sole":"rubber/plastics","covers_ankle":False},
    {"id":"fw-train-012","split":"train","product":"children's leather ankle boots, leather outer sole, insole 22 cm","code":"6403519100","sex":"child/less than 24 cm","sole":"leather","covers_ankle":True},
    {"id":"fw-train-013","split":"train","product":"women's leather riding-style ankle boot with leather sole, not sports footwear","code":"6403519900","sex":"women","sole":"leather","covers_ankle":True},
    {"id":"fw-train-014","split":"train","product":"men's smart ankle boot, leather upper and leather sole","code":"6403519500","sex":"men","sole":"leather","covers_ankle":True},
    {"id":"fw-train-015","split":"train","product":"women's leather loafers, rubber sole, do not cover ankle","code":"6403999800","sex":"women","sole":"rubber/plastics","covers_ankle":False},
    {"id":"fw-train-016","split":"train","product":"men's leather loafers with rubber outer sole","code":"6403999600","sex":"men","sole":"rubber/plastics","covers_ankle":False},
    {"id":"fw-train-017","split":"train","product":"leather upper shoes with rubber outer soles, cannot identify men's or women's, insole 26 cm","code":"6403999300","sex":"unisex/unknown","sole":"rubber/plastics","covers_ankle":False},
    {"id":"fw-train-018","split":"train","product":"leather upper ankle boots with rubber soles, cannot identify men's or women's, insole 26 cm","code":"6403919300","sex":"unisex/unknown","sole":"rubber/plastics","covers_ankle":True},
    {"id":"fw-train-019","split":"train","product":"women's ankle boot described as leather shoe, but outsole is rubber","code":"6403919800","sex":"women","sole":"rubber/plastics","covers_ankle":True},
    {"id":"fw-train-020","split":"train","product":"men's ankle boot described as leather shoe, but outsole is rubber","code":"6403919600","sex":"men","sole":"rubber/plastics","covers_ankle":True},
    {"id":"fw-train-021","split":"train","product":"women's leather ankle boot, leather sole, 24.5 cm insole","code":"6403519900","sex":"women","sole":"leather","covers_ankle":True},
    {"id":"fw-train-022","split":"train","product":"men's leather ankle boot, leather sole, 28 cm insole","code":"6403519500","sex":"men","sole":"leather","covers_ankle":True},
    {"id":"fw-train-023","split":"train","product":"women's leather shoes, composition leather sole, not covering ankle","code":"6403999800","sex":"women","sole":"composition leather","covers_ankle":False},
    {"id":"fw-train-024","split":"train","product":"men's leather shoes, composition leather sole, not covering ankle","code":"6403999600","sex":"men","sole":"composition leather","covers_ankle":False},

    # EVAL: same decision boundary, different wording
    {"id":"fw-eval-001","split":"eval","product":"ladies leather upper boots covering ankle with leather outer sole","code":"6403519900","sex":"women","sole":"leather","covers_ankle":True},
    {"id":"fw-eval-002","split":"eval","product":"mens leather ankle boot, leather outsole, fashion boot","code":"6403519500","sex":"men","sole":"leather","covers_ankle":True},
    {"id":"fw-eval-003","split":"eval","product":"ladies leather shoes with rubber outsole, below ankle","code":"6403999800","sex":"women","sole":"rubber/plastics","covers_ankle":False},
    {"id":"fw-eval-004","split":"eval","product":"mens leather shoes with plastic sole, not covering ankle","code":"6403999600","sex":"men","sole":"rubber/plastics","covers_ankle":False},
    {"id":"fw-eval-005","split":"eval","product":"child leather upper footwear, rubber sole, insole under 24 cm","code":"6403999100","sex":"child/less than 24 cm","sole":"rubber/plastics","covers_ankle":False},
    {"id":"fw-eval-006","split":"eval","product":"child ankle boot, leather upper and leather outsole, insole under 24 cm","code":"6403519100","sex":"child/less than 24 cm","sole":"leather","covers_ankle":True},
    {"id":"fw-eval-007","split":"eval","product":"women leather ankle boot with rubber sole, not protective toe cap","code":"6403919800","sex":"women","sole":"rubber/plastics","covers_ankle":True},
    {"id":"fw-eval-008","split":"eval","product":"men leather ankle boot with rubber sole, non-safety fashion boot","code":"6403919600","sex":"men","sole":"rubber/plastics","covers_ankle":True},

    # LOCKED TEST: do not train on these
    {"id":"fw-test-001","split":"locked-test","product":"women's black leather ankle boots, leather uppers and leather outer soles","code":"6403519900","sex":"women","sole":"leather","covers_ankle":True},
    {"id":"fw-test-002","split":"locked-test","product":"men's brown leather ankle boots, leather sole, insole 27 cm","code":"6403519500","sex":"men","sole":"leather","covers_ankle":True},
    {"id":"fw-test-003","split":"locked-test","product":"ladies leather brogues with rubber outsole, not covering the ankle","code":"6403999800","sex":"women","sole":"rubber/plastics","covers_ankle":False},
    {"id":"fw-test-004","split":"locked-test","product":"men's leather oxford shoes, synthetic rubber outer sole","code":"6403999600","sex":"men","sole":"rubber/plastics","covers_ankle":False},
    {"id":"fw-test-005","split":"locked-test","product":"leather upper ankle boot for women with rubber sole","code":"6403919800","sex":"women","sole":"rubber/plastics","covers_ankle":True},
    {"id":"fw-test-006","split":"locked-test","product":"leather upper ankle boot for men with plastic sole","code":"6403919600","sex":"men","sole":"rubber/plastics","covers_ankle":True},
    {"id":"fw-test-007","split":"locked-test","product":"children's leather upper shoes with rubber soles, 23 cm insole","code":"6403999100","sex":"child/less than 24 cm","sole":"rubber/plastics","covers_ankle":False},
    {"id":"fw-test-008","split":"locked-test","product":"children's leather ankle boot with leather outsole, 23 cm insole","code":"6403519100","sex":"child/less than 24 cm","sole":"leather","covers_ankle":True},
    {"id":"fw-test-009","split":"locked-test","product":"women's formal leather shoes, outer sole of composition leather","code":"6403999800","sex":"women","sole":"composition leather","covers_ankle":False},
    {"id":"fw-test-010","split":"locked-test","product":"men's formal leather shoes, outer sole of composition leather","code":"6403999600","sex":"men","sole":"composition leather","covers_ankle":False},
    {"id":"fw-test-011","split":"locked-test","product":"women leather Chelsea boot, covers ankle, leather outer sole","code":"6403519900","sex":"women","sole":"leather","covers_ankle":True},
    {"id":"fw-test-012","split":"locked-test","product":"men leather Chelsea boot, covers ankle, leather outer sole","code":"6403519500","sex":"men","sole":"leather","covers_ankle":True},
    {"id":"fw-test-013","split":"locked-test","product":"ladies leather court shoe with plastic sole","code":"6403999800","sex":"women","sole":"rubber/plastics","covers_ankle":False},
    {"id":"fw-test-014","split":"locked-test","product":"mens leather derby shoe with rubber sole","code":"6403999600","sex":"men","sole":"rubber/plastics","covers_ankle":False},
    {"id":"fw-test-015","split":"locked-test","product":"unisex leather upper shoe, rubber outsole, 25 cm insole","code":"6403999300","sex":"unisex/unknown","sole":"rubber/plastics","covers_ankle":False},
    {"id":"fw-test-016","split":"locked-test","product":"unisex leather ankle boot, rubber outsole, 25 cm insole","code":"6403919300","sex":"unisex/unknown","sole":"rubber/plastics","covers_ankle":True},
    {"id":"fw-test-017","split":"locked-test","product":"women's ankle boot, leather upper, rubber outsole despite leather product description","code":"6403919800","sex":"women","sole":"rubber/plastics","covers_ankle":True},
    {"id":"fw-test-018","split":"locked-test","product":"men's ankle boot, leather upper, rubber outsole despite leather product description","code":"6403919600","sex":"men","sole":"rubber/plastics","covers_ankle":True},
    {"id":"fw-test-019","split":"locked-test","product":"women's leather sole ankle boots, leather uppers, size 40","code":"6403519900","sex":"women","sole":"leather","covers_ankle":True},
    {"id":"fw-test-020","split":"locked-test","product":"men's leather sole ankle boots, leather uppers, size 44","code":"6403519500","sex":"men","sole":"leather","covers_ankle":True},
    {"id":"fw-test-021","split":"locked-test","product":"girls leather shoes, rubber soles, 22 cm insole","code":"6403999100","sex":"child/less than 24 cm","sole":"rubber/plastics","covers_ankle":False},
    {"id":"fw-test-022","split":"locked-test","product":"boys leather ankle boot, leather sole, 22 cm insole","code":"6403519100","sex":"child/less than 24 cm","sole":"leather","covers_ankle":True},
    {"id":"fw-test-023","split":"locked-test","product":"ladies slip-on leather shoes, rubber sole, below ankle","code":"6403999800","sex":"women","sole":"rubber/plastics","covers_ankle":False},
    {"id":"fw-test-024","split":"locked-test","product":"mens slip-on leather shoes, rubber sole, below ankle","code":"6403999600","sex":"men","sole":"rubber/plastics","covers_ankle":False},
]

SYSTEM = "You classify goods for UK customs. Return only valid worker-json."


def target_json(case: Dict[str, Any]) -> Dict[str, Any]:
    heading_reason = (
        "Classify in heading 6403 because the item is footwear with uppers of leather."
    )
    subheading_reason = (
        f"The subheading turns on outer sole and ankle coverage: sole={case['sole']}; "
        f"covers_ankle={case['covers_ankle']}; user/size group={case['sex']}."
    )
    return {
        "correctHsCode": case["code"],
        "confidence": 0.94,
        "girsApplied": [
            {
                "rule": "GIR 1",
                "analysis": heading_reason,
                "conclusion": "Heading 6403 applies.",
            },
            {
                "rule": "GIR 6",
                "analysis": subheading_reason,
                "conclusion": f"Commodity code {case['code']} applies.",
            },
        ],
        "complianceVerdict": "COMPLIANT",
        "verdictReasoning": (
            f"{heading_reason} {subheading_reason} Therefore use commodity code "
            f"{case['code']}."
        ),
        "officerExplanation": (
            f"{heading_reason} {subheading_reason} "
            f"Therefore use commodity code {case['code']}."
        ),
    }


def to_row(case: Dict[str, Any]) -> Dict[str, Any]:
    prompt = (
        "Classify this product as worker-json. "
        "Use UK commodity code level where enough facts are provided.\n"
        f"Product: {case['product']}"
    )
    return {
        "id": case["id"],
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": prompt},
            {"role": "assistant", "content": json.dumps(target_json(case), ensure_ascii=False, separators=(",", ":"))},
        ],
        "metadata": {
            "dataset": OUTPUT_DIR_NAME,
            "split": case["split"],
            "review_status": "reviewed",
            "topic": "footwear_640351_vs_640399",
            "source": "manual_correction_case",
            "do_not_train": case["split"] == "locked-test",
        },
    }


def write_jsonl(path: Path, rows: Iterable[Dict[str, Any]]) -> None:
    with path.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--out", default=OUTPUT_DIR_NAME)
    args = p.parse_args()
    out = Path(args.out)
    if out.name != OUTPUT_DIR_NAME:
        raise SystemExit(f"Refusing output dir {out}; required name is {OUTPUT_DIR_NAME}")
    out.mkdir(parents=True, exist_ok=True)
    (out / "source").mkdir(exist_ok=True)
    (out / "tests").mkdir(exist_ok=True)

    (out / "source" / "footwear-reviewed-cases.json").write_text(json.dumps(CASES, indent=2, ensure_ascii=False), encoding="utf-8")
    rows = [to_row(c) for c in CASES]
    for split, filename in [("train","train.jsonl"),("eval","eval.jsonl"),("locked-test","tests/locked-footwear.jsonl")]:
        write_jsonl(out / filename, [r for r in rows if r["metadata"]["split"] == split])

    counts = {s: sum(1 for c in CASES if c["split"] == s) for s in ["train","eval","locked-test"]}
    audit = f"""# lora-dataset-worker-json-v2 Audit\n\nGenerated correction dataset for v3. No training run.\n\n## Counts\n\n- train: {counts['train']}\n- eval: {counts['eval']}\n- locked test: {counts['locked-test']}\n\n## Scope\n\nFocused only on footwear failures:\n\n- leather shoes\n- footwear subheadings\n- 640351 vs 640399\n- men/women leather shoes\n- leather outer sole vs rubber/plastic/composition leather outer sole, without adding composition leather unless stated\n\n## Guardrails\n\n- locked tests are written only to `tests/locked-footwear.jsonl`\n- locked tests are not duplicated in train/eval\n- no old `lora-dataset` directory name\n- output target remains `lora-output-worker-json-v2` for any future training\n"""
    (out / "AUDIT-REPORT.md").write_text(audit, encoding="utf-8")
    print(json.dumps({"ok": True, "out": str(out), "counts": counts}, indent=2))

if __name__ == "__main__":
    main()


