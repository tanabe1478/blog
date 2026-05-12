#!/usr/bin/env python3
"""Print a Gyazo OAuth authorization URL.

This is a local helper for obtaining a Gyazo access token during development.
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path
import secrets
import sys
import urllib.parse

AUTHORIZE_URL = "https://gyazo.com/oauth/authorize"
DEFAULT_CALLBACK_URL = "http://localhost:4173/gyazo/callback"


def load_dotenv(path: Path = Path(".env")) -> None:
    if not path.is_file():
        return

    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def build_authorize_url(client_id: str, redirect_uri: str, state: str) -> str:
    query = urllib.parse.urlencode(
        {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "state": state,
        }
    )
    return f"{AUTHORIZE_URL}?{query}"


def main() -> int:
    parser = argparse.ArgumentParser(description="Print a Gyazo OAuth authorization URL")
    parser.add_argument("--redirect-uri", help="OAuth redirect URI")
    parser.add_argument("--state", help="CSRF state. Defaults to a random value")
    args = parser.parse_args()

    load_dotenv()
    client_id = os.environ.get("GYAZO_CLIENT_ID")
    if not client_id:
        print("error: missing GYAZO_CLIENT_ID", file=sys.stderr)
        return 1

    redirect_uri = args.redirect_uri or os.environ.get("GYAZO_CALLBACK_URL") or DEFAULT_CALLBACK_URL
    state = args.state or secrets.token_urlsafe(24)

    print(build_authorize_url(client_id, redirect_uri, state))
    print(f"state={state}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
