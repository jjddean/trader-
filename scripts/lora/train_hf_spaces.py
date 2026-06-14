#!/usr/bin/env python3
"""
Start LoRA training on HuggingFace Spaces GPU (AutoTrain) — no Colab.

Requires in .env.local:
  HF_TOKEN=hf_...
  HF_USERNAME=your_username  (optional — inferred from token)

Usage:
  python scripts/lora/train_hf_spaces.py
  python scripts/lora/download_adapters.py   # after training finishes
  npm run lora:deploy
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

ROOT = Path(__file__).resolve().parents[2]
CONFIG = ROOT / "scripts" / "lora" / "autotrain.config.yaml"
OUT_DIR = ROOT / "lora-output"


def ensure_autotrain() -> None:
    try:
        import autotrain  # noqa: F401
    except ImportError:
        subprocess.check_call(
            [sys.executable, "-m", "pip", "install", "-q", "autotrain-advanced", "huggingface_hub"],
        )


def main() -> None:
    from env import load_dotenv_local, require_hf

    load_dotenv_local()
    username, token = require_hf()
    os.environ["HF_USERNAME"] = username
    os.environ["HF_TOKEN"] = token

    from huggingface_hub import login

    login(token=token, add_to_git_credential=False)

    dataset_repo = os.environ.get("HF_DATASET_REPO") or f"{username}/hs-classifier-train-v1"
    project = os.environ.get("HF_PROJECT_NAME", "hs-classifier-v1")
    backend = os.environ.get("HF_TRAIN_BACKEND", "spaces-t4-medium")

    csv_local = ROOT / "lora-dataset" / "train-autotrain.csv"
    if not csv_local.is_file():
        subprocess.check_call([sys.executable, str(ROOT / "scripts" / "lora" / "convert_dataset.py")])

    # Upload dataset so Spaces backend can read it
    env = {**os.environ, "HF_DATASET_REPO": dataset_repo}
    subprocess.check_call(
        [sys.executable, str(ROOT / "scripts" / "lora" / "upload_dataset.py")],
        env=env,
    )

    yaml_text = f"""task: llm-sft
base_model: mistralai/Mistral-7B-Instruct-v0.2
project_name: {project}
log: tensorboard
backend: {backend}

data:
  path: {dataset_repo}
  train_split: train-autotrain
  valid_split: null
  chat_template: null
  column_mapping:
    text_column: text

params:
  block_size: 2048
  model_max_length: 2048
  epochs: 3
  batch_size: 1
  lr: 2e-4
  peft: true
  quantization: none
  target_modules: all-linear
  padding: right
  optimizer: adamw_torch
  scheduler: linear
  gradient_accumulation: 4
  mixed_precision: fp16

hub:
  username: ${{HF_USERNAME}}
  token: ${{HF_TOKEN}}
  push_to_hub: true
"""
    CONFIG.write_text(yaml_text, encoding="utf-8")
    print(f"Wrote {CONFIG}")
    print(f"Starting AutoTrain on {backend} (HF Spaces GPU)…")

    ensure_autotrain()
    subprocess.check_call(["autotrain", "--config", str(CONFIG)], env=os.environ)

    print("\nTraining job submitted / running on HuggingFace.")
    print(f"Model will push to: https://huggingface.co/{username}/{project}")
    print("\nWhen complete, run:")
    print("  python scripts/lora/download_adapters.py")
    print("  npm run lora:deploy")


if __name__ == "__main__":
    main()
