#!/usr/bin/env python3
"""Exchange a Gyazo OAuth code for an access token.

This is a helper for the future Markmesh extension OAuth flow. It does not store
secrets or tokens; copy the resulting access_token into your local secret store
or ignored .env during development.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import sys
import urllib.error
import urllib.parse
import urllib.request

TOKEN_URL = "https://gyazo.com/oauth/token"
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


def exchange_code(code: str, client_id: str, client_secret: str, redirect_uri: str) -> dict:
    payload = urllib.parse.urlencode(
        {
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": redirect_uri,
            "code": code,
            "grant_type": "authorization_code",
        }
    ).encode("utf-8")

    request = urllib.request.Request(
        TOKEN_URL,
        data=payload,
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "tanabe1478-blog-gyazo-oauth",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        message = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Gyazo token exchange failed: HTTP {error.code}: {message}") from error


def main() -> int:
    parser = argparse.ArgumentParser(description="Exchange a Gyazo OAuth code for an access token")
    parser.add_argument("code", help="code query parameter received by the callback URL")
    parser.add_argument("--redirect-uri", default=None, help="OAuth redirect URI")
    args = parser.parse_args()

    load_dotenv()
    client_id = os.environ.get("GYAZO_CLIENT_ID")
    client_secret = os.environ.get("GYAZO_CLIENT_SECRET")
    redirect_uri = args.redirect_uri or os.environ.get("GYAZO_CALLBACK_URL") or DEFAULT_CALLBACK_URL

    missing = [
        name
        for name, value in [
            ("GYAZO_CLIENT_ID", client_id),
            ("GYAZO_CLIENT_SECRET", client_secret),
        ]
        if not value
    ]
    if missing:
        print(f"error: missing {', '.join(missing)}", file=sys.stderr)
        return 1

    result = exchange_code(args.code, client_id, client_secret, redirect_uri)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
