#!/usr/bin/env python3
"""
Train hs-classifier-v1 LoRA (Mistral-7B-Instruct) with Unsloth.
Output: lora-output/adapter_model.safetensors + adapter_config.json (Cloudflare Workers AI).

Usage:
  python scripts/lora/train_unsloth.py
  LORA_DATA_DIR=./lora-dataset LORA_OUT_DIR=./lora-output python scripts/lora/train_unsloth.py

Google Colab: upload lora-colab-bundle.zip, unzip, run:
  !python train_unsloth.py
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent


def resolve_repo_root() -> Path:
    """Repo root when run as scripts/lora/train_unsloth.py; script dir on Colab flat upload."""
    for depth in (2, 1, 0):
        if depth < len(SCRIPT_DIR.parents):
            return SCRIPT_DIR.parents[depth]
    return SCRIPT_DIR


ROOT = resolve_repo_root()


def resolve_data_dir() -> Path:
    if os.environ.get("LORA_DATA_DIR"):
        return Path(os.environ["LORA_DATA_DIR"])
    for candidate in (SCRIPT_DIR, SCRIPT_DIR / "lora-dataset", ROOT / "lora-dataset"):
        if (candidate / "train.csv").is_file():
            return candidate
    return ROOT / "lora-dataset"


def resolve_out_dir() -> Path:
    if os.environ.get("LORA_OUT_DIR"):
        return Path(os.environ["LORA_OUT_DIR"])
    if (SCRIPT_DIR / "train.csv").is_file():
        return SCRIPT_DIR / "lora-output"
    return ROOT / "lora-output"


DATA_DIR = resolve_data_dir()
OUT_DIR = resolve_out_dir()
MODEL_ID = os.environ.get("LORA_BASE_MODEL", "unsloth/mistral-7b-instruct-v0.2-bnb-4bit")
EPOCHS = float(os.environ.get("LORA_EPOCHS", "3"))
MAX_SEQ = int(os.environ.get("LORA_MAX_SEQ", "2048"))
LORA_R = int(os.environ.get("LORA_R", "8"))


def in_colab() -> bool:
    return "COLAB_RELEASE_TAG" in os.environ


def ensure_unsloth() -> None:
    if in_colab():
        print("Colab: installing Unsloth + deps…")
        subprocess.check_call(
            [sys.executable, "-m", "pip", "install", "-q", "unsloth", "datasets", "trl"],
        )
    try:
        import unsloth  # noqa: F401
    except ImportError:
        print("Installing unsloth (first run may take several minutes)…")
        subprocess.check_call(
            [sys.executable, "-m", "pip", "install", "unsloth", "datasets", "trl"],
        )


def load_training_texts(csv_path: Path) -> list[str]:
    if not csv_path.is_file():
        raise FileNotFoundError(f"Missing {csv_path} — run: npm run lora:prepare")

    texts: list[str] = []
    with csv_path.open(encoding="utf-8") as handle:
        for i, raw in enumerate(handle):
            line = raw.strip()
            if not line:
                continue
            if i == 0 and line == "text":
                continue
            row = json.loads(line)
            text = row.get("text")
            if not isinstance(text, str) or not text.strip():
                raise ValueError(f"Bad row {i + 1} in {csv_path}")
            texts.append(text)

    if len(texts) < 100:
        raise ValueError(f"Only {len(texts)} rows in {csv_path} — need at least 100")
    return texts


def patch_adapter_for_cloudflare(out_dir: Path) -> None:
    config_path = out_dir / "adapter_config.json"
    if not config_path.is_file():
        raise FileNotFoundError(f"No adapter_config.json in {out_dir}")

    config = json.loads(config_path.read_text(encoding="utf-8"))
    config["model_type"] = "mistral"
    config_path.write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")
    print(f"Patched {config_path} (model_type=mistral)")


def main() -> None:
    ensure_unsloth()

    import torch
    from datasets import Dataset
    from trl import SFTTrainer
    from transformers import TrainingArguments
    from unsloth import FastLanguageModel

    if not torch.cuda.is_available():
        print("ERROR: No CUDA GPU. On Windows use Colab bundle: npm run lora:colab")
        sys.exit(1)

    train_csv = DATA_DIR / "train.csv"
    texts = load_training_texts(train_csv)
    print(f"Loaded {len(texts)} training rows from {train_csv}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # 4-bit base fits Colab T4; LoRA adapters export for Cloudflare (see TRAINING_GUIDE)
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

    dataset = Dataset.from_dict({"text": texts})

    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=dataset,
        dataset_text_field="text",
        max_seq_length=MAX_SEQ,
        args=TrainingArguments(
            output_dir=str(OUT_DIR / "checkpoints"),
            per_device_train_batch_size=2,
            gradient_accumulation_steps=4,
            warmup_steps=50,
            num_train_epochs=EPOCHS,
            learning_rate=2e-4,
            fp16=not torch.cuda.is_bf16_supported(),
            bf16=torch.cuda.is_bf16_supported(),
            logging_steps=25,
            save_strategy="no",
            optim="adamw_8bit",
            report_to="none",
        ),
    )

    print(f"Training {EPOCHS} epoch(s) on {torch.cuda.get_device_name(0)}…")
    trainer.train()

    model.save_pretrained(str(OUT_DIR))
    tokenizer.save_pretrained(str(OUT_DIR))
    patch_adapter_for_cloudflare(OUT_DIR)

    adapter = OUT_DIR / "adapter_model.safetensors"
    if not adapter.is_file():
        raise FileNotFoundError(f"Expected {adapter} after save")

    print(f"\nDone. Adapters in {OUT_DIR}")
    print("Deploy: npm run lora:deploy")


if __name__ == "__main__":
    main()
