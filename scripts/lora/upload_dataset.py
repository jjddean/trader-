#!/usr/bin/env python3
"""
Upload train-autotrain.csv to HuggingFace dataset repo.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from env import require_hf
from huggingface_hub import HfApi
from huggingface_hub.errors import HfHubHTTPError

from dataset_readme import dataset_readme

ROOT = Path(__file__).resolve().parents[2]
JSON_TRAIN = ROOT / "lora-dataset" / "train.csv"  # JSON-per-line — Unsloth / Colab
AUTOTRAIN_CSV = ROOT / "lora-dataset" / "train-autotrain.csv"  # plain text col — AutoTrain


def main() -> None:
    username, token = require_hf()
    repo_id = os.environ.get("HF_DATASET_REPO") or f"{username}/hs-classifier-train-v1"

    if not JSON_TRAIN.is_file():
        raise SystemExit(f"Missing {JSON_TRAIN} — run: npm run lora:prepare")

    api = HfApi(token=token)
    try:
        api.create_repo(repo_id=repo_id, repo_type="dataset", private=True, exist_ok=True)
    except HfHubHTTPError as exc:
        if "403" in str(exc) or "Forbidden" in str(exc):
            raise SystemExit(
                f"\n403 Forbidden creating dataset {repo_id}.\n"
                "Your HF token lacks write/repo-create permission.\n"
                "Run: python scripts/lora/check_hf_token.py\n"
                "Or create a Write token: https://huggingface.co/settings/tokens\n"
            ) from exc
        raise
    except TypeError:
        try:
            api.create_repo(repo_id=repo_id, repo_type="dataset", private=True)
        except Exception:
            pass

    api.upload_file(
        path_or_fileobj=str(JSON_TRAIN),
        path_in_repo="train.csv",
        repo_id=repo_id,
        repo_type="dataset",
        commit_message="Freightcode hs-classifier train.csv (JSON lines, Unsloth)",
    )
    if AUTOTRAIN_CSV.is_file():
        api.upload_file(
            path_or_fileobj=str(AUTOTRAIN_CSV),
            path_in_repo="train-autotrain.csv",
            repo_id=repo_id,
            repo_type="dataset",
            commit_message="AutoTrain plain-text CSV",
        )
    api.upload_file(
        path_or_fileobj=dataset_readme().encode("utf-8"),
        path_in_repo="README.md",
        repo_id=repo_id,
        repo_type="dataset",
        commit_message="Dataset card for AutoTrain",
    )
    print(f"Uploaded dataset -> https://huggingface.co/datasets/{repo_id}")
    print(repo_id)


if __name__ == "__main__":
    main()
