#!/usr/bin/env python3
"""Train or dry-run the reviewed worker-json correction dataset.

Default mode is dry-run only. It validates and formats the JSONL chat rows, proves
locked tests are excluded from training, and exits before importing GPU training
libraries. Actual training requires both:

  python scripts/lora/train_worker_json_unsloth.py --execute
  LORA_ALLOW_WORKER_JSON_TRAIN=1
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

from validate_worker_json_dataset import validate_row

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATA_DIR = ROOT / "lora-dataset-worker-json-v2"
DEFAULT_OUT_DIR = ROOT / "lora-output-worker-json-v2"
MODEL_ID = os.environ.get("LORA_BASE_MODEL", "unsloth/mistral-7b-instruct-v0.2-bnb-4bit")
EPOCHS = float(os.environ.get("LORA_EPOCHS", "1"))
MAX_SEQ = int(os.environ.get("LORA_MAX_SEQ", "2048"))
LORA_R = int(os.environ.get("LORA_R", "8"))


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for line_no, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not raw.strip():
            continue
        try:
            row = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise ValueError(f"{path}:{line_no} invalid JSONL: {exc}") from exc
        if not isinstance(row, dict):
            raise ValueError(f"{path}:{line_no} row must be an object")
        rows.append(row)
    return rows


def assistant_payload(row: dict[str, Any]) -> dict[str, Any]:
    content = row["messages"][2]["content"]
    payload = json.loads(content)
    if not isinstance(payload, dict):
        raise ValueError(f"{row.get('id')} assistant payload must be an object")
    return payload


def format_mistral_text(row: dict[str, Any]) -> str:
    messages = row["messages"]
    system = messages[0]["content"].strip()
    user = messages[1]["content"].strip()
    assistant = messages[2]["content"].strip()
    return f"[INST] {system}\n\n{user} [/INST]\n{assistant}"


def load_worker_json_dataset(data_dir: Path) -> tuple[list[str], list[str], dict[str, int]]:
    paths = {
        "train": data_dir / "train.jsonl",
        "eval": data_dir / "eval.jsonl",
        "locked-test": data_dir / "tests" / "locked-footwear.jsonl",
    }
    split_rows: dict[str, list[dict[str, Any]]] = {}
    for split, path in paths.items():
        if not path.is_file():
            raise FileNotFoundError(f"Missing {path}")
        rows = load_jsonl(path)
        if not rows:
            raise ValueError(f"No rows in {path}")
        for row in rows:
            validate_row(row, split)
        split_rows[split] = rows

    for row in split_rows["train"] + split_rows["eval"]:
        if row.get("metadata", {}).get("do_not_train") is True:
            raise ValueError(f"{row.get('id')} is marked do_not_train outside locked-test")
    for row in split_rows["locked-test"]:
        if row.get("metadata", {}).get("do_not_train") is not True:
            raise ValueError(f"{row.get('id')} locked-test row is not marked do_not_train")

    train_prompts = {row["messages"][1]["content"] for row in split_rows["train"]}
    eval_prompts = {row["messages"][1]["content"] for row in split_rows["eval"]}
    locked_prompts = {row["messages"][1]["content"] for row in split_rows["locked-test"]}
    overlap = (train_prompts | eval_prompts) & locked_prompts
    if overlap:
        raise ValueError(f"locked-test prompt overlap: {sorted(overlap)}")

    train_texts = [format_mistral_text(row) for row in split_rows["train"]]
    eval_texts = [format_mistral_text(row) for row in split_rows["eval"]]
    counts = {split: len(rows) for split, rows in split_rows.items()}
    return train_texts, eval_texts, counts


def ensure_unsloth() -> None:
    try:
        import unsloth  # noqa: F401
    except ImportError:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "unsloth", "datasets", "trl"])


def patch_adapter_for_cloudflare(out_dir: Path) -> None:
    config_path = out_dir / "adapter_config.json"
    if not config_path.is_file():
        raise FileNotFoundError(f"No adapter_config.json in {out_dir}")
    config = json.loads(config_path.read_text(encoding="utf-8"))
    config["model_type"] = "mistral"
    config_path.write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")


def train(train_texts: list[str], out_dir: Path) -> None:
    if os.environ.get("LORA_ALLOW_WORKER_JSON_TRAIN") != "1":
        raise SystemExit("Refusing training: set LORA_ALLOW_WORKER_JSON_TRAIN=1 and pass --execute.")

    import torch

    if not torch.cuda.is_available():
        raise SystemExit("Refusing training: no CUDA GPU available. Unsloth dependencies were not imported or installed.")

    ensure_unsloth()

    from unsloth import FastLanguageModel
    from datasets import Dataset
    from trl import SFTTrainer
    from transformers import TrainingArguments

    out_dir.mkdir(parents=True, exist_ok=True)
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=MODEL_ID,
        max_seq_length=MAX_SEQ,
        dtype=None,
        load_in_4bit=True,
    )
    model = FastLanguageModel.get_peft_model(
        model,
        r=LORA_R,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        lora_alpha=LORA_R * 2,
        lora_dropout=0,
        bias="none",
        use_gradient_checkpointing="unsloth",
        random_state=3407,
    )
    dataset = Dataset.from_dict({"text": train_texts})
    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=dataset,
        dataset_text_field="text",
        max_seq_length=MAX_SEQ,
        args=TrainingArguments(
            output_dir=str(out_dir / "checkpoints"),
            per_device_train_batch_size=2,
            gradient_accumulation_steps=4,
            warmup_steps=5,
            num_train_epochs=EPOCHS,
            learning_rate=2e-4,
            fp16=not torch.cuda.is_bf16_supported(),
            bf16=torch.cuda.is_bf16_supported(),
            logging_steps=5,
            save_strategy="no",
            optim="adamw_8bit",
            report_to="none",
        ),
    )
    trainer.train()
    model.save_pretrained(str(out_dir))
    tokenizer.save_pretrained(str(out_dir))
    patch_adapter_for_cloudflare(out_dir)


def main() -> None:
    parser = argparse.ArgumentParser(description="Worker-json LoRA training loader")
    parser.add_argument("--data-dir", default=str(DEFAULT_DATA_DIR))
    parser.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR))
    parser.add_argument("--execute", action="store_true", help="Actually train; requires LORA_ALLOW_WORKER_JSON_TRAIN=1")
    args = parser.parse_args()

    data_dir = Path(args.data_dir)
    out_dir = Path(args.out_dir)
    if data_dir.name != "lora-dataset-worker-json-v2":
        raise SystemExit("Refusing dataset path: expected lora-dataset-worker-json-v2")
    if out_dir.name != "lora-output-worker-json-v2":
        raise SystemExit("Refusing output path: expected lora-output-worker-json-v2")

    train_texts, eval_texts, counts = load_worker_json_dataset(data_dir)
    print(json.dumps({
        "ok": True,
        "mode": "execute" if args.execute else "dry-run",
        "data_dir": str(data_dir),
        "out_dir": str(out_dir),
        "counts": counts,
        "train_texts": len(train_texts),
        "eval_texts": len(eval_texts),
        "locked_test_training_rows": 0,
        "first_train_chars": len(train_texts[0]) if train_texts else 0,
    }, indent=2))

    if not args.execute:
        return
    train(train_texts, out_dir)


if __name__ == "__main__":
    main()

