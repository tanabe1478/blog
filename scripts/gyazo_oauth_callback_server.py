#!/usr/bin/env python3
"""Receive a Gyazo OAuth callback on localhost and optionally exchange code.

Open the URL printed by scripts/gyazo_authorize_url.py, then run this server to
capture the callback at /gyazo/callback. This is a local development helper for
the future Markmesh extension OAuth flow.
"""

from __future__ import annotations

import argparse
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import os
from pathlib import Path
import sys
from urllib.parse import parse_qs, urlparse

# Import sibling helper without making scripts a package.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from exchange_gyazo_oauth_code import exchange_code, load_dotenv  # noqa: E402

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 4173
DEFAULT_CALLBACK_URL = "http://localhost:4173/gyazo/callback"


class CallbackState:
    def __init__(self, expected_state: str | None, exchange: bool) -> None:
        self.expected_state = expected_state
        self.exchange = exchange
        self.result: dict | None = None
        self.error: str | None = None
        self.done = False


class Handler(BaseHTTPRequestHandler):
    server: "CallbackServer"

    def log_message(self, format: str, *args: object) -> None:  # noqa: A002 - stdlib signature
        return

    def do_GET(self) -> None:  # noqa: N802 - stdlib hook
        parsed = urlparse(self.path)
        if parsed.path != "/gyazo/callback":
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b"Not Found")
            return

        query = parse_qs(parsed.query)
        code = query.get("code", [None])[0]
        state = query.get("state", [None])[0]

        callback_state = self.server.callback_state
        if not code:
            callback_state.error = "callback did not include code"
        elif callback_state.expected_state and state != callback_state.expected_state:
            callback_state.error = "state mismatch"
        else:
            callback_state.result = {"code": code, "state": state}
            if callback_state.exchange:
                callback_state.result = self.exchange_code(code)

        callback_state.done = True
        self.send_response(200 if not callback_state.error else 400)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        body = self.response_html(callback_state)
        self.wfile.write(body.encode("utf-8"))

    def exchange_code(self, code: str) -> dict:
        load_dotenv()
        client_id = os.environ.get("GYAZO_CLIENT_ID")
        client_secret = os.environ.get("GYAZO_CLIENT_SECRET")
        redirect_uri = os.environ.get("GYAZO_CALLBACK_URL") or DEFAULT_CALLBACK_URL
        if not client_id or not client_secret:
            raise RuntimeError("GYAZO_CLIENT_ID and GYAZO_CLIENT_SECRET are required for --exchange")
        return exchange_code(code, client_id, client_secret, redirect_uri)

    def response_html(self, callback_state: CallbackState) -> str:
        if callback_state.error:
            content = f"<h1>Gyazo OAuth failed</h1><p>{callback_state.error}</p>"
        else:
            payload = json.dumps(callback_state.result, ensure_ascii=False, indent=2)
            content = f"<h1>Gyazo OAuth callback received</h1><pre>{payload}</pre>"
        return f"<!doctype html><html><body>{content}<p>You can close this window.</p></body></html>"


class CallbackServer(HTTPServer):
    def __init__(self, server_address: tuple[str, int], callback_state: CallbackState) -> None:
        super().__init__(server_address, Handler)
        self.callback_state = callback_state


def main() -> int:
    parser = argparse.ArgumentParser(description="Receive a Gyazo OAuth callback")
    parser.add_argument("--host", default=DEFAULT_HOST)
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--state", help="expected OAuth state")
    parser.add_argument("--exchange", action="store_true", help="exchange received code for access token")
    args = parser.parse_args()

    callback_state = CallbackState(expected_state=args.state, exchange=args.exchange)
    server = CallbackServer((args.host, args.port), callback_state)
    print(f"Listening on http://{args.host}:{args.port}/gyazo/callback")
    if args.state:
        print(f"Expecting state={args.state}")

    while not callback_state.done:
        server.handle_request()

    if callback_state.error:
        print(f"error: {callback_state.error}", file=sys.stderr)
        return 1

    print(json.dumps(callback_state.result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
