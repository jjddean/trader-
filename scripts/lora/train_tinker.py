#!/usr/bin/env python3
"""
Experimental: train hs-classifier-v1 via Thinking Machines Tinker API.

Docs: https://tinker-docs.thinkingmachines.ai/tinker/

BLOCKER (verify before relying on this path):
  Cloudflare Workers AI expects adapters for:
    @cf/mistral/mistral-7b-instruct-v0.2-lora
  Tinker docs list Qwen, Llama, DeepSeek, Kimi, Nemotron — NOT Mistral-7B-Instruct-v0.2.
  Run:  python scripts/lora/train_tinker.py --list-models
  If Mistral is absent, Colab/Unsloth remains the correct path for CF deploy.

Setup:
  pip install tinker tinker-cookbook
  TINKER_API_KEY=...  (Tinker Console)

Usage:
  python scripts/lora/train_tinker.py --list-models
  python scripts/lora/train_tinker.py --smoke 20          # 20 rows, 1 epoch
  python scripts/lora/train_tinker.py                     # full train.csv
  python scripts/lora/train_tinker.py --export checkpoint-final

After export, merge to HF PEFT (if supported for your base model):
  python -m tinker_cookbook.scripts.merge_tinker_adapter_to_hf_model ...
Then patch adapter_config.json model_type=mistral and npm run lora:deploy
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "lora-dataset"
OUT_DIR = ROOT / "lora-output"

# Target for Cloudflare — must exist on Tinker or this path won't deploy to CF Mistral LoRA.
CF_BASE_MODEL = os.environ.get(
    "TINKER_BASE_MODEL",
    "mistralai/Mistral-7B-Instruct-v0.2",
)
LORA_RANK = int(os.environ.get("TINKER_LORA_RANK", "16"))
EPOCHS = float(os.environ.get("TINKER_EPOCHS", "3"))
MAX_ROWS = int(os.environ.get("TINKER_MAX_ROWS", "0"))  # 0 = all
BATCH_SIZE = int(os.environ.get("TINKER_BATCH_SIZE", "4"))
LEARNING_RATE = float(os.environ.get("TINKER_LR", "2e-4"))
CHECKPOINT_NAME = os.environ.get("TINKER_CHECKPOINT", "hs-classifier-final")


def load_training_texts(csv_path: Path, limit: int = 0) -> list[str]:
    texts: list[str] = []
    with csv_path.open(encoding="utf-8") as handle:
        for i, raw in enumerate(handle):
            line = raw.strip()
            if not line or (i == 0 and line == "text"):
                continue
            texts.append(json.loads(line)["text"])
            if limit and len(texts) >= limit:
                break
    if len(texts) < 1:
        raise ValueError(f"No rows in {csv_path}")
    return texts


def split_mistral_inst(text: str) -> tuple[str, str]:
    """Parse our train.csv row: [INST] prompt [/INST] completion."""
    if "[/INST]" not in text:
        raise ValueError("Expected Mistral [INST]...[/INST] format")
    before, after = text.split("[/INST]", 1)
    prompt = before.replace("[INST]", "", 1).strip()
    completion = after.strip()
    if not prompt or not completion:
        raise ValueError("Empty prompt or completion after [/INST] split")
    return prompt, completion


def build_mistral_inst_tokens(tokenizer, prompt: str, completion: str) -> tuple[list[int], list[int], list[float]]:
    """
    Tokenize prompt + completion with Mistral [INST] template.
    Loss weights: 0 on prompt tokens, 1 on completion tokens.
    """
    prefix = f"[INST] {prompt} [/INST]\n\n"
    full = prefix + completion

    prefix_ids = tokenizer.encode(prefix, add_special_tokens=False)
    full_ids = tokenizer.encode(full, add_special_tokens=False)
    if len(full_ids) <= len(prefix_ids):
        raise ValueError("Completion tokenized to empty sequence")

    # Datum: input = full[:-1], targets = full[1:], weights = 0 on prompt shift region
    input_ids = full_ids[:-1]
    target_ids = full_ids[1:]
    prompt_len = max(len(prefix_ids) - 1, 0)
    weights = [0.0] * prompt_len + [1.0] * (len(input_ids) - prompt_len)
    if len(weights) != len(input_ids):
        weights = [0.0 if i < prompt_len else 1.0 for i in range(len(input_ids))]
    return input_ids, target_ids, weights


async def list_models() -> None:
    import tinker

    client = tinker.ServiceClient()
    caps = await client.get_server_capabilities_async()
    models = getattr(caps, "supported_models", None) or caps
    print("Tinker server capabilities:")
    if isinstance(models, list):
        for m in models:
            name = getattr(m, "model_name", None) or getattr(m, "name", None) or m
            print(f"  - {name}")
        mistral = [m for m in models if "mistral" in str(m).lower()]
        if mistral:
            print(f"\nMistral-related ({len(mistral)}):")
            for m in mistral:
                print(f"  ✓ {m}")
        else:
            print("\n⚠ No Mistral models found — CF deploy path needs Colab/Unsloth.")
    else:
        print(models)


async def train(smoke_rows: int = 0) -> None:
    import tinker
    from tinker import types

    if not os.environ.get("TINKER_API_KEY"):
        raise SystemExit("Set TINKER_API_KEY (https://tinker-docs.thinkingmachines.ai/tinker/quickstart/)")

    train_csv = DATA_DIR / "train.csv"
    if not train_csv.is_file():
        raise SystemExit(f"Missing {train_csv} — run: npm run lora:prepare")

    limit = smoke_rows or MAX_ROWS or 0
    texts = load_training_texts(train_csv, limit=limit)
    print(f"Loaded {len(texts)} rows from {train_csv}")
    print(f"Base model: {CF_BASE_MODEL}  rank={LORA_RANK}  epochs={EPOCHS}")

    service = tinker.ServiceClient()
    training_client = await service.create_lora_training_client_async(
        base_model=CF_BASE_MODEL,
        rank=LORA_RANK,
    )
    tokenizer = training_client.get_tokenizer()

    datums: list[types.Datum] = []
    skipped = 0
    for text in texts:
        try:
            prompt, completion = split_mistral_inst(text)
            input_ids, target_ids, weights = build_mistral_inst_tokens(tokenizer, prompt, completion)
            datums.append(
                types.Datum(
                    model_input=types.ModelInput.from_ints(tokens=input_ids),
                    loss_fn_inputs={
                        "weights": weights,
                        "target_tokens": target_ids,
                    },
                )
            )
        except Exception as exc:
            skipped += 1
            if skipped <= 3:
                print(f"Skip row: {exc}")

    if not datums:
        raise SystemExit("No valid Datum rows — check tokenizer / base model / train.csv format")
    print(f"Built {len(datums)} datums ({skipped} skipped)")

    steps_per_epoch = max(1, (len(datums) + BATCH_SIZE - 1) // BATCH_SIZE)
    total_steps = int(steps_per_epoch * EPOCHS)
    print(f"Training ~{total_steps} steps ({EPOCHS} epoch(s), batch={BATCH_SIZE})")

    step = 0
    for epoch in range(int(EPOCHS) if EPOCHS == int(EPOCHS) else 1):
        # Fractional epochs: outer loop simplified — full impl would shuffle + partial epoch
        for start in range(0, len(datums), BATCH_SIZE):
            batch = datums[start : start + BATCH_SIZE]
            fwdbwd = await training_client.forward_backward_async(batch, loss_fn="cross_entropy")
            result = await fwdbwd.result_async()
            await (await training_client.optim_step_async(
                types.AdamParams(learning_rate=LEARNING_RATE)
            )).result_async()
            step += 1
            loss = getattr(result, "loss", None)
            if step == 1 or step % 25 == 0 or step == total_steps:
                print(f"step {step}/{total_steps}  loss={loss}")

    sampling = training_client.save_weights_and_get_sampling_client(name=CHECKPOINT_NAME)
    print(f"Saved checkpoint: {CHECKPOINT_NAME}")
    print(f"Sampling client ready: {sampling}")

    # Smoke sample
    sample_text = texts[0]
    prompt, _ = split_mistral_inst(sample_text)
    prefix = f"[INST] {prompt} [/INST]\n\n"
    prompt_input = types.ModelInput.from_ints(tokenizer.encode(prefix, add_special_tokens=False))
    params = types.SamplingParams(max_tokens=128, temperature=0.1, stop=["\n\n"])
    sample = await sampling.sample_async(prompt=prompt_input, num_samples=1, sampling_params=params)
    print("Sample output:")
    print(tokenizer.decode(sample.sequences[0].tokens))


async def export_checkpoint(name: str) -> None:
    """Download Tinker checkpoint — requires tinker CLI / cookbook weights helpers."""
    print(
        "Export is model-specific. After training, use Tinker cookbook:\n"
        "  tinker checkpoint download <run-id> <checkpoint-name> -o lora-output/\n"
        "  python -m tinker_cookbook.scripts.merge_tinker_adapter_to_hf_model ...\n"
        "Then patch adapter_config.json (model_type=mistral) and npm run lora:deploy"
    )
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Target dir: {OUT_DIR}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Freightcode hs-classifier via Tinker API")
    parser.add_argument("--list-models", action="store_true", help="Print Tinker supported models")
    parser.add_argument("--smoke", type=int, metavar="N", help="Train on first N rows only")
    parser.add_argument("--export", metavar="NAME", help="Export checkpoint hints")
    args = parser.parse_args()

    if args.list_models:
        asyncio.run(list_models())
        return
    if args.export:
        asyncio.run(export_checkpoint(args.export))
        return
    asyncio.run(train(smoke_rows=args.smoke or 0))


if __name__ == "__main__":
    main()
