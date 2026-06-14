#!/usr/bin/env python3
"""Download LoRA adapter files from HuggingFace model repo → lora-output/."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from huggingface_hub import hf_hub_download, list_repo_files

from env import require_hf

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "lora-output"


def main() -> None:
    username, token = require_hf()
    repo_id = os.environ.get("HF_PROJECT_REPO") or f"{username}/hs-classifier-v1"

    files = list_repo_files(repo_id, repo_type="model", token=token)
    needed = ["adapter_model.safetensors", "adapter_config.json"]
    missing = [f for f in needed if f not in files]
    if missing:
        raise SystemExit(
            f"Model repo {repo_id} missing {missing}. Training may still be running.\n"
            f"Files in repo: {files[:20]}"
        )

    OUT.mkdir(parents=True, exist_ok=True)
    for name in needed:
        path = hf_hub_download(repo_id=repo_id, filename=name, token=token)
        dest = OUT / name
        dest.write_bytes(Path(path).read_bytes())
        print(f"Saved {dest}")

    cfg_path = OUT / "adapter_config.json"
    cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
    cfg["model_type"] = "mistral"
    cfg_path.write_text(json.dumps(cfg, indent=2) + "\n", encoding="utf-8")
    print("Patched adapter_config.json (model_type=mistral)")
    print("\nRun: npm run lora:deploy")


if __name__ == "__main__":
    main()
