#!/usr/bin/env python3
"""Kaggle GPU training — PEFT/TRL (no Unsloth; offline wheels, keep Kaggle CUDA torch)."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

INPUT_ROOT = Path("/kaggle/input")
WORKING = Path("/kaggle/working")
OUT_DIR = WORKING / "lora-output"
MODEL_ID = "mistralai/Mistral-7B-Instruct-v0.2"
EPOCHS = 3
MAX_SEQ = 2048
LORA_R = 8

# Never pip-install these — Kaggle ships CUDA torch; our offline wheels include CPU torch.
SKIP_WHEELS = {"torch", "torchvision", "torchaudio", "triton"}


def require_gpu() -> None:
    import torch

    print(f"torch={torch.__version__} cuda={torch.version.cuda}")
    print(f"cuda_available={torch.cuda.is_available()} device_count={torch.cuda.device_count()}")
    if not torch.cuda.is_available():
        raise SystemExit(
            "No CUDA GPU visible. If Kaggle shows T4 in settings, pip may have overwritten "
            "CUDA torch — this script now avoids that. Otherwise check GPU quota at "
            "kaggle.com/settings."
        )
    print(f"GPU: {torch.cuda.get_device_name(0)}")


def pip_install_offline(*packages: str) -> None:
    wheels_dirs = [p for p in INPUT_ROOT.iterdir() if p.is_dir() and "wheel" in p.name.lower()]
    if not wheels_dirs:
        raise SystemExit(f"No wheels dataset under {INPUT_ROOT}")

    wheel_args: list[str] = []
    for wd in wheels_dirs:
        wheel_args.extend(["--no-index", f"--find-links={wd}"])

    # --no-deps: do not pull CPU torch from wheels; use Kaggle's preinstalled CUDA torch.
    cmd = [sys.executable, "-m", "pip", "install", "-q", *wheel_args, "--no-deps", *packages]
    subprocess.check_call(cmd)


def find_train_csv() -> Path:
    for base in INPUT_ROOT.iterdir():
        candidate = base / "train.csv"
        if candidate.is_file():
            return candidate
    raise FileNotFoundError(f"No train.csv under {INPUT_ROOT}")


def load_training_texts(csv_path: Path) -> list[str]:
    texts: list[str] = []
    with csv_path.open(encoding="utf-8") as handle:
        for i, raw in enumerate(handle):
            line = raw.strip()
            if not line or (i == 0 and line == "text"):
                continue
            texts.append(json.loads(line)["text"])
    return texts


def patch_adapter(out_dir: Path) -> None:
    cfg_path = out_dir / "adapter_config.json"
    cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
    cfg["model_type"] = "mistral"
    cfg_path.write_text(json.dumps(cfg, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    require_gpu()
    pip_install_offline("peft", "bitsandbytes", "trl", "accelerate", "transformers", "datasets")

    import torch
    if not torch.cuda.is_available():
        raise SystemExit("CUDA lost after pip install — CPU torch was installed by mistake")

    from datasets import Dataset
    from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
    from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
    from trl import SFTConfig, SFTTrainer

    texts = load_training_texts(find_train_csv())
    print(f"Loaded {len(texts)} rows")
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    bnb = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.float16,
        bnb_4bit_use_double_quant=True,
    )
    model = AutoModelForCausalLM.from_pretrained(
        MODEL_ID,
        quantization_config=bnb,
        device_map="auto",
        trust_remote_code=True,
    )
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    model = prepare_model_for_kbit_training(model)
    model = get_peft_model(
        model,
        LoraConfig(
            r=LORA_R,
            lora_alpha=LORA_R * 2,
            lora_dropout=0.05,
            bias="none",
            task_type="CAUSAL_LM",
            target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        ),
    )

    trainer = SFTTrainer(
        model=model,
        processing_class=tokenizer,
        train_dataset=Dataset.from_dict({"text": texts}),
        args=SFTConfig(
            output_dir=str(OUT_DIR / "checkpoints"),
            per_device_train_batch_size=1,
            gradient_accumulation_steps=8,
            warmup_steps=50,
            num_train_epochs=EPOCHS,
            learning_rate=2e-4,
            fp16=True,
            logging_steps=25,
            save_strategy="no",
            optim="paged_adamw_8bit",
            report_to="none",
            max_length=MAX_SEQ,
            dataset_text_field="text",
        ),
    )

    print(f"Training on {torch.cuda.get_device_name(0)}…")
    trainer.train()
    model.save_pretrained(str(OUT_DIR))
    tokenizer.save_pretrained(str(OUT_DIR))
    patch_adapter(OUT_DIR)

    for name in ("adapter_model.safetensors", "adapter_config.json"):
        src = OUT_DIR / name
        if src.is_file():
            (WORKING / name).write_bytes(src.read_bytes())
            print(f"Exported {name}")


if __name__ == "__main__":
    main()
