#!/usr/bin/env python3
"""Verify HF token can create repos (required for AutoTrain Spaces)."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from env import require_hf
from huggingface_hub import HfApi
from huggingface_hub.errors import HfHubHTTPError


def check_write_access(api: HfApi, username: str) -> None:
    """Probe repo creation; delete test repo if created."""
    test_repo = f"{username}/freightcode-lora-preflight-test"
    try:
        api.create_repo(repo_id=test_repo, repo_type="dataset", private=True, exist_ok=True)
        try:
            api.delete_repo(repo_id=test_repo, repo_type="dataset")
        except Exception:
            pass
        print("HF write access: OK")
    except HfHubHTTPError as exc:
        if "403" in str(exc) or "Forbidden" in str(exc):
            raise SystemExit(
                "\nHF token cannot create repos (403 Forbidden).\n\n"
                "Your token is likely fine-grained with no write permissions.\n"
                "Fix at https://huggingface.co/settings/tokens — choose ONE:\n\n"
                "  A) New token -> Type: Write (classic, simplest)\n"
                "  B) Edit fine-grained token -> add permission:\n"
                "     Repositories -> Create repos / write on your account\n\n"
                "Update HF_TOKEN in .env.local, then re-run: npm run lora:bootstrap\n"
            ) from exc
        raise


def main() -> None:
    username, token = require_hf()
    api = HfApi(token=token)
    info = api.whoami()
    role = info.get("auth", {}).get("accessToken", {}).get("role", "unknown")
    print(f"HF user: {username} (token role: {role})")
    check_write_access(api, username)


if __name__ == "__main__":
    main()
