#!/usr/bin/env python3
"""Load HF_TOKEN / HF_USERNAME from .env.local into os.environ."""

from __future__ import annotations

import os
from pathlib import Path


def load_dotenv_local() -> None:
    root = Path(__file__).resolve().parents[2]
    env_path = root / ".env.local"
    if not env_path.is_file():
        return
    for raw in env_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def require_hf() -> tuple[str, str]:
    load_dotenv_local()
    token = os.environ.get("HF_TOKEN", "").strip()
    if not token:
        try:
            from huggingface_hub import HfFolder

            token = (HfFolder.get_token() or "").strip()
            if token:
                os.environ["HF_TOKEN"] = token
        except Exception:
            pass
    username = os.environ.get("HF_USERNAME", "").strip()
    if not token:
        raise SystemExit(
            "Missing HF_TOKEN. Add to .env.local:\n"
            "  HF_TOKEN=hf_...\n"
            "  HF_USERNAME=your_hf_username\n"
            "Or run: huggingface-cli login\n"
            "Create token: https://huggingface.co/settings/tokens (Write)"
        )
    if not username:
        from huggingface_hub import HfApi

        username = HfApi(token=token).whoami()["name"]
        os.environ["HF_USERNAME"] = username
    return username, token
