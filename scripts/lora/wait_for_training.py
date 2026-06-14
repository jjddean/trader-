#!/usr/bin/env python3
"""Poll HuggingFace model repo until LoRA adapter files appear, then download."""

from __future__ import annotations

import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from huggingface_hub import list_repo_files

from env import require_hf

NEEDED = ("adapter_model.safetensors", "adapter_config.json")


def adapters_ready(repo_id: str, token: str) -> tuple[bool, list[str]]:
    try:
        files = list_repo_files(repo_id, repo_type="model", token=token)
    except Exception:
        return False, []
    return all(name in files for name in NEEDED), files


def main() -> None:
    username, token = require_hf()
    repo_id = os.environ.get("HF_PROJECT_REPO") or f"{username}/hs-classifier-v1"
    interval = int(os.environ.get("HF_POLL_SECONDS", "120"))
    max_wait = int(os.environ.get("HF_POLL_MAX_SECONDS", str(6 * 3600)))

    print(f"Waiting for {repo_id} adapters (poll every {interval}s, max {max_wait // 60}m)…")
    deadline = time.time() + max_wait
    while time.time() < deadline:
        ready, files = adapters_ready(repo_id, token)
        if ready:
            print(f"Adapters ready in {repo_id}")
            subprocess = __import__("subprocess")
            root = Path(__file__).resolve().parents[2]
            subprocess.check_call([sys.executable, str(root / "scripts" / "lora" / "download_adapters.py")])
            return
        preview = ", ".join(files[:8]) if files else "(repo empty or not created yet)"
        print(f"  not ready — {preview}")
        time.sleep(interval)

    raise SystemExit(f"Timed out after {max_wait // 60}m. Check https://huggingface.co/{repo_id}")


if __name__ == "__main__":
    main()
