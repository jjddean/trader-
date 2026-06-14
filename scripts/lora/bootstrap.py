#!/usr/bin/env python3
"""One-shot bootstrap: prepare dataset, optional HF login, train on Spaces GPU."""

from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "scripts" / "lora"
sys.path.insert(0, str(SCRIPTS))


def main() -> None:
    from env import load_dotenv_local, require_hf
    from huggingface_hub import login

    load_dotenv_local()

    token_arg = os.environ.get("HF_TOKEN", "").strip()
    if len(sys.argv) > 1 and sys.argv[1].startswith("hf_"):
        token_arg = sys.argv[1].strip()
        os.environ["HF_TOKEN"] = token_arg

    if token_arg:
        login(token=token_arg, add_to_git_credential=False)
        print("HF token saved to local cache.")

    username, token = require_hf()
    print(f"HuggingFace user: {username}")

    import subprocess

    subprocess.check_call([sys.executable, str(SCRIPTS / "check_hf_token.py")], cwd=ROOT)
    subprocess.check_call([sys.executable, str(SCRIPTS / "pipeline.py"), "prepare"], cwd=ROOT)
    subprocess.check_call([sys.executable, str(SCRIPTS / "pipeline.py"), "install"], cwd=ROOT)
    subprocess.check_call([sys.executable, str(SCRIPTS / "train_hf_spaces.py")], cwd=ROOT, env=os.environ)
    print("\nNext (after HF job finishes):")
    print("  npm run lora:wait")
    print("  npm run lora:deploy")


if __name__ == "__main__":
    main()
