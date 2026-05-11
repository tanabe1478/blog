#!/usr/bin/env python3
"""Upload an image to Gyazo and print Markdown.

Temporary bridge until the Markmesh extension provides `Blog: Upload Image to Gyazo`.
The access token is read from GYAZO_ACCESS_TOKEN so it is never stored in this repository.
"""

from __future__ import annotations

import argparse
import json
import mimetypes
import os
from pathlib import Path
import sys
import urllib.error
import urllib.request
import uuid

UPLOAD_URL = "https://upload.gyazo.com/api/upload"


def build_multipart_body(path: Path) -> tuple[bytes, str]:
    boundary = f"----tanabe-blog-{uuid.uuid4().hex}"
    content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    image = path.read_bytes()

    parts: list[bytes] = []
    parts.append(
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="imagedata"; filename="{path.name}"\r\n'
        f"Content-Type: {content_type}\r\n\r\n".encode()
    )
    parts.append(image)
    parts.append(f"\r\n--{boundary}--\r\n".encode())
    return b"".join(parts), boundary


def upload(path: Path, token: str) -> dict:
    body, boundary = build_multipart_body(path)
    request = urllib.request.Request(
        UPLOAD_URL,
        data=body,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "User-Agent": "tanabe1478-blog-gyazo-upload",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        message = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Gyazo upload failed: HTTP {error.code}: {message}") from error


def markdown_for(result: dict, alt: str, linked: bool) -> str:
    image_url = result.get("url")
    permalink_url = result.get("permalink_url") or image_url
    if not image_url:
        raise RuntimeError(f"Gyazo response did not include url: {result}")
    if linked:
        return f"[![{alt}]({image_url})]({permalink_url})"
    return f"![{alt}]({image_url})"


def main() -> int:
    parser = argparse.ArgumentParser(description="Upload an image to Gyazo and print Markdown")
    parser.add_argument("image", type=Path, help="image file to upload")
    parser.add_argument("--alt", help="alt text. Defaults to the filename stem")
    parser.add_argument(
        "--direct",
        action="store_true",
        help="print direct image Markdown instead of linked image Markdown",
    )
    args = parser.parse_args()

    if not args.image.is_file():
        print(f"error: image file not found: {args.image}", file=sys.stderr)
        return 1

    token = os.environ.get("GYAZO_ACCESS_TOKEN")
    if not token:
        print("error: GYAZO_ACCESS_TOKEN is not set", file=sys.stderr)
        return 1

    result = upload(args.image, token)
    alt = args.alt or args.image.stem
    print(markdown_for(result, alt, linked=not args.direct))
    return 0


if __name__ == "__main__":
    sys.exit(main())
