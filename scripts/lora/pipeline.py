#!/usr/bin/env python3
"""
One-command LoRA pipeline (max automation from your PC).

  python scripts/lora/pipeline.py prepare   # generate + convert CSV
  python scripts/lora/pipeline.py install   # pip install HF deps
  python scripts/lora/pipeline.py train     # HF Spaces GPU (needs HF_TOKEN)
  python scripts/lora/pipeline.py wait      # poll until adapters ready + download
  python scripts/lora/pipeline.py download  # pull adapters when HF job done
  python scripts/lora/pipeline.py deploy    # wrangler → Cloudflare
  python scripts/lora/pipeline.py status    # check HF model repo files
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "scripts" / "lora"


def run(args: list[str]) -> None:
    subprocess.check_call([sys.executable, *args])


def prepare() -> None:
    # The v1 synthetic generator (generate-training-data.mjs) was deleted.
    # Use the v2 reasoning-consistency dataset instead: npm run lora:prepare:v2
    raise SystemExit(
        "v1 dataset generation has been removed. Run: npm run lora:prepare:v2"
    )


def train() -> None:
    prepare()
    run([str(SCRIPTS / "train_hf_spaces.py")])


def wait_and_download() -> None:
    run([str(SCRIPTS / "wait_for_training.py")])


def install() -> None:
    req = ROOT / "requirements-lora.txt"
    subprocess.check_call(
        [sys.executable, "-m", "pip", "install", "-r", str(req)],
        cwd=ROOT,
    )


def download() -> None:
    run([str(SCRIPTS / "download_adapters.py")])


def deploy() -> None:
    subprocess.check_call(["node", str(SCRIPTS / "run.mjs"), "deploy"], cwd=ROOT)


def status() -> None:
    sys.path.insert(0, str(SCRIPTS))
    from env import require_hf
    from huggingface_hub import list_repo_files

    username, token = require_hf()
    repo = f"{username}/hs-classifier-v1"
    try:
        files = list_repo_files(repo, repo_type="model", token=token)
        print(f"Model repo {repo}:")
        for f in sorted(files):
            print(f"  {f}")
    except Exception as exc:
        print(f"Model repo not ready: {exc}")


def main() -> None:
    step = sys.argv[1] if len(sys.argv) > 1 else "train"
    steps = {
        "prepare": prepare,
        "install": install,
        "train": train,
        "wait": wait_and_download,
        "download": download,
        "deploy": deploy,
        "status": status,
    }
    if step not in steps:
        print(__doc__)
        sys.exit(1)
    steps[step]()


if __name__ == "__main__":
    main()
