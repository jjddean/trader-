#!/usr/bin/env python3
"""Upload Colab notebook to HF dataset + print one-click Colab URL."""

from __future__ import annotations

import sys
import webbrowser
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from env import require_hf
from huggingface_hub import HfApi

ROOT = Path(__file__).resolve().parents[2]
NOTEBOOK = ROOT / "scripts" / "lora" / "Train_HS_Classifier.ipynb"
DATASET = "Jjddean1/hs-classifier-train-v1"


def main() -> None:
    username, token = require_hf()
    repo = DATASET if DATASET.startswith(username) else f"{username}/hs-classifier-train-v1"

    api = HfApi(token=token)
    api.upload_file(
        path_or_fileobj=str(ROOT / "scripts" / "lora" / "train_unsloth.py"),
        path_in_repo="train_unsloth.py",
        repo_id=repo,
        repo_type="dataset",
        commit_message="Colab training script",
    )
    api.upload_file(
        path_or_fileobj=str(NOTEBOOK),
        path_in_repo="Train_HS_Classifier.ipynb",
        repo_id=repo,
        repo_type="dataset",
        commit_message="Colab one-click training notebook",
    )

    url = f"https://colab.research.google.com/#url=https://huggingface.co/datasets/{repo}/resolve/main/Train_HS_Classifier.ipynb"
    print(f"Notebook uploaded to {repo}")
    print(f"\nOpen in Colab:\n  {url}\n")
    print("Then: Runtime -> T4 GPU -> Run all")
    try:
        webbrowser.open(url)
    except Exception:
        pass


if __name__ == "__main__":
    main()
