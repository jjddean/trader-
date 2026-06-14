#!/usr/bin/env python3
"""
Programmatic LoRA training on Kaggle GPU (free T4, no Colab manual steps).

Requires in .env.local (from https://www.kaggle.com/settings -> Create New Token):
  KAGGLE_USERNAME=your_username
  KAGGLE_KEY=your_api_key

Usage:
  python scripts/lora/kaggle_train.py          # upload dataset + run kernel + wait + download
  python scripts/lora/kaggle_train.py upload   # dataset only
  python scripts/lora/kaggle_train.py run      # kernel only (dataset must exist)
  python scripts/lora/kaggle_train.py status   # poll kernel status
  python scripts/lora/kaggle_train.py download # pull adapters to lora-output/
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "scripts" / "lora"
KAGGLE_DIR = SCRIPTS / "kaggle"
DATASET_SLUG = os.environ.get("KAGGLE_DATASET", "hs-classifier-train")
KERNEL_SLUG = os.environ.get("KAGGLE_KERNEL", "freightcode-hs-lora-gpu")
OUT_DIR = ROOT / "lora-output"
POLL_SECONDS = int(os.environ.get("KAGGLE_POLL_SECONDS", "60"))
# Never upload — Kaggle has CUDA torch; offline CPU torch breaks GPU detection.
SKIP_WHEELS = frozenset({"torch", "torchvision", "torchaudio", "triton"})


def load_env() -> None:
    sys.path.insert(0, str(SCRIPTS))
    from env import load_dotenv_local

    load_dotenv_local()


def resolve_kaggle_username() -> str:
    explicit = os.environ.get("KAGGLE_USERNAME", "").strip()
    if explicit:
        return explicit

    kaggle_json = Path.home() / ".kaggle" / "kaggle.json"
    if kaggle_json.is_file():
        try:
            data = json.loads(kaggle_json.read_text(encoding="utf-8"))
            name = str(data.get("username", "")).strip()
            if name:
                return name
        except Exception:
            pass

    try:
        result = subprocess.run(
            ["kaggle", "config", "view"],
            capture_output=True,
            text=True,
            check=True,
        )
        for line in result.stdout.splitlines():
            if "username:" in line:
                name = line.split("username:", 1)[1].strip()
                if name:
                    return name
    except Exception:
        pass

    hf_user = os.environ.get("HF_USERNAME", "").strip()
    if hf_user:
        return hf_user.lower()

    raise SystemExit("Set KAGGLE_USERNAME in .env.local (e.g. jasondean1).")


def require_kaggle() -> tuple[str, str]:
    load_env()
    api_token = os.environ.get("KAGGLE_API_TOKEN", "").strip()
    key = os.environ.get("KAGGLE_KEY", "").strip()
    legacy_user = os.environ.get("KAGGLE_USERNAME", "").strip()

    if api_token:
        os.environ["KAGGLE_API_TOKEN"] = api_token
    elif legacy_user and key:
        os.environ["KAGGLE_USERNAME"] = legacy_user
        os.environ["KAGGLE_KEY"] = key
    else:
        raise SystemExit(
            "Missing Kaggle credentials. Add to .env.local:\n"
            "  KAGGLE_API_TOKEN=KGAT_...\n"
            "  KAGGLE_USERNAME=jasondean1  (optional — auto-detected from ~/.kaggle)\n"
        )

    username = resolve_kaggle_username()
    os.environ["KAGGLE_USERNAME"] = username
    return username, api_token or key


def kaggle_cmd(*args: str) -> None:
    subprocess.check_call(["kaggle", *args], cwd=ROOT)


def ensure_kaggle_cli() -> None:
    try:
        subprocess.run(["kaggle", "--version"], check=True, capture_output=True)
    except (FileNotFoundError, subprocess.CalledProcessError):
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "kaggle"])


def patch_metadata(username: str) -> None:
    ds_meta = json.loads((KAGGLE_DIR / "dataset-metadata.json").read_text(encoding="utf-8"))
    ds_meta["id"] = f"{username.lower()}/hs-classifier-train"
    (KAGGLE_DIR / "dataset-metadata.json").write_text(json.dumps(ds_meta, indent=2) + "\n", encoding="utf-8")

    km_meta = json.loads((KAGGLE_DIR / "kernel-metadata.json").read_text(encoding="utf-8"))
    km_meta["id"] = f"{username.lower()}/{KERNEL_SLUG}"
    km_meta["enable_gpu"] = True
    km_meta["machine_shape"] = "NvidiaTeslaT4"
    km_meta["dataset_sources"] = [
        f"{username.lower()}/hs-classifier-train",
        f"{username.lower()}/hs-classifier-wheels",
    ]
    (KAGGLE_DIR / "kernel-metadata.json").write_text(json.dumps(km_meta, indent=2) + "\n", encoding="utf-8")
    if km_meta.get("kernel_type") == "notebook":
        sync_notebook_from_script()


def sync_notebook_from_script() -> None:
    """Embed train_kernel.py in the notebook Kaggle actually runs."""
    script_path = KAGGLE_DIR / "train_kernel.py"
    notebook_path = KAGGLE_DIR / "train_kernel.ipynb"
    source = script_path.read_text(encoding="utf-8")
    if source.startswith("#!"):
        source = source.split("\n", 1)[1]

    cell_source = [f"{line}\n" for line in source.splitlines()]
    if cell_source:
        cell_source[-1] = cell_source[-1].rstrip("\n") + "\n"

    notebook = {
        "cells": [
            {
                "cell_type": "code",
                "metadata": {},
                "source": cell_source,
                "outputs": [],
                "execution_count": None,
            }
        ],
        "metadata": {
            "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
            "language_info": {"name": "python", "version": "3.12.0"},
            "kaggle": {
                "accelerator": "nvidiaTeslaT4",
                "isInternetEnabled": True,
                "language": "python",
                "sourceType": "notebook",
                "isGpuEnabled": True,
            },
        },
        "nbformat": 4,
        "nbformat_minor": 4,
    }
    notebook_path.write_text(json.dumps(notebook, indent=2) + "\n", encoding="utf-8")


def upload_dataset(username: str) -> None:
    train_csv = ROOT / "lora-dataset" / "train.csv"
    if not train_csv.is_file():
        subprocess.check_call([sys.executable, str(SCRIPTS / "pipeline.py"), "prepare"], cwd=ROOT)

    staging = ROOT / ".kaggle-dataset-staging"
    if staging.exists():
        shutil.rmtree(staging)
    staging.mkdir()
    shutil.copy2(train_csv, staging / "train.csv")
    shutil.copy2(KAGGLE_DIR / "dataset-metadata.json", staging / "dataset-metadata.json")

    slug = f"{username.lower()}/hs-classifier-train"
    print(f"Uploading dataset -> {slug} …")
    create = subprocess.run(
        ["kaggle", "datasets", "create", "-p", str(staging)],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    if create.returncode != 0:
        if "already in use" in (create.stderr or create.stdout or "").lower():
            print("Dataset already exists — uploading new version…")
        else:
            print((create.stderr or create.stdout or "Dataset create failed").strip())
            print("Retrying as new version…")
        kaggle_cmd("datasets", "version", "-p", str(staging), "-m", "Freightcode train.csv update")

    shutil.rmtree(staging, ignore_errors=True)
    print(f"Dataset ready: https://www.kaggle.com/datasets/{username}/hs-classifier-train")


def upload_wheels(username: str) -> None:
    wheels_src = ROOT / ".kaggle-wheels"
    if not wheels_src.is_dir() or not any(wheels_src.glob("*.whl")):
        wheels_src.mkdir(exist_ok=True)
        print("Downloading Linux wheels for offline Kaggle install…")
        subprocess.check_call(
            [
                sys.executable, "-m", "pip", "download",
                "peft", "trl", "accelerate", "bitsandbytes",
                "-d", str(wheels_src),
                "--platform", "manylinux2014_x86_64",
                "--python-version", "312",
                "--only-binary=:all:",
            ],
            cwd=ROOT,
        )

    staging = ROOT / ".kaggle-wheels-staging"
    if staging.exists():
        shutil.rmtree(staging)
    staging.mkdir()
    for whl in wheels_src.glob("*.whl"):
        stem = whl.name.split("-")[0].lower()
        if stem in SKIP_WHEELS:
            continue
        shutil.copy2(whl, staging / whl.name)
    shutil.copy2(KAGGLE_DIR / "wheels-metadata.json", staging / "dataset-metadata.json")

    wheels_slug = f"{username.lower()}/hs-classifier-wheels"
    print(f"Uploading wheels -> {wheels_slug} …")
    create = subprocess.run(
        ["kaggle", "datasets", "create", "-p", str(staging)],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    if create.returncode != 0:
        if "already in use" in (create.stderr or create.stdout or "").lower():
            print("Wheels dataset already exists — uploading new version…")
        else:
            print((create.stderr or create.stdout or "Wheels create failed").strip())
            print("Retrying as new version…")
        kaggle_cmd("datasets", "version", "-p", str(staging), "-m", "PEFT/TRL wheels for offline kernel")
    shutil.rmtree(staging, ignore_errors=True)
    print(f"Wheels ready: https://www.kaggle.com/datasets/{username}/hs-classifier-wheels")


def push_and_run(username: str) -> None:
    slug = f"{username.lower()}/{KERNEL_SLUG}"
    print(f"Pushing kernel -> {slug} …")
    kaggle_cmd("kernels", "push", "-p", str(KAGGLE_DIR), "--accelerator", "NvidiaTeslaT4")
    print(f"Kernel started (GPU). Track: https://www.kaggle.com/code/{slug}")


def kernel_status(username: str) -> str:
    slug = f"{username.lower()}/{KERNEL_SLUG}"
    result = subprocess.run(
        ["kaggle", "kernels", "status", slug],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    line = (result.stdout or result.stderr or "").strip()
    print(line)
    return line


def wait_for_complete(username: str, max_minutes: int = 180) -> None:
    deadline = time.time() + max_minutes * 60
    while time.time() < deadline:
        status = kernel_status(username)
        lower = status.lower()
        if "complete" in lower and "error" not in lower:
            print("Kernel finished successfully.")
            return
        if any(x in lower for x in ("error", "failed", "cancelled")):
            raise SystemExit(f"Kernel failed: {status}\nCheck: https://www.kaggle.com/code/{username.lower()}/{KERNEL_SLUG}")
        time.sleep(POLL_SECONDS)
    raise SystemExit(f"Timed out after {max_minutes}m — check Kaggle UI")


def download_output(username: str) -> None:
    if OUT_DIR.exists():
        shutil.rmtree(OUT_DIR)
    OUT_DIR.mkdir(parents=True)
    slug = f"{username.lower()}/{KERNEL_SLUG}"
    print(f"Downloading kernel output -> {OUT_DIR}")
    kaggle_cmd("kernels", "output", slug, "-p", str(OUT_DIR))

    adapter = OUT_DIR / "adapter_model.safetensors"
    nested = OUT_DIR / "lora-output" / "adapter_model.safetensors"
    if not adapter.is_file() and nested.is_file():
        for name in ("adapter_model.safetensors", "adapter_config.json"):
            src = OUT_DIR / "lora-output" / name
            if src.is_file():
                shutil.copy2(src, OUT_DIR / name)

    if not (OUT_DIR / "adapter_model.safetensors").is_file():
        raise SystemExit(f"No adapter in {OUT_DIR} — kernel may have failed")

    cfg = OUT_DIR / "adapter_config.json"
    if cfg.is_file():
        data = json.loads(cfg.read_text(encoding="utf-8"))
        data["model_type"] = "mistral"
        cfg.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")

    print(f"Adapters saved to {OUT_DIR}")
    print("Run: npm run lora:deploy")


def main() -> None:
    step = sys.argv[1] if len(sys.argv) > 1 else "all"
    ensure_kaggle_cli()
    username, _ = require_kaggle()
    patch_metadata(username)

    if step in ("all", "upload"):
        upload_dataset(username)
        upload_wheels(username)
    if step in ("all", "run"):
        push_and_run(username)
    if step in ("all", "wait"):
        wait_for_complete(username)
    if step in ("all", "download"):
        download_output(username)
    if step == "status":
        kernel_status(username)


if __name__ == "__main__":
    main()
