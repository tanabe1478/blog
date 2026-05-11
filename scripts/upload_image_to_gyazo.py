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
SUPPORTED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp"}


def load_dotenv(path: Path = Path(".env")) -> None:
    if not path.is_file():
        return

    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def has_supported_image_signature(path: Path) -> bool:
    header = path.read_bytes()[:16]
    return (
        header.startswith(b"\x89PNG\r\n\x1a\n")
        or header.startswith(b"\xff\xd8\xff")
        or header.startswith(b"GIF87a")
        or header.startswith(b"GIF89a")
        or (header.startswith(b"RIFF") and header[8:12] == b"WEBP")
    )


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
    if args.image.suffix.lower() not in SUPPORTED_IMAGE_EXTENSIONS:
        supported = ", ".join(sorted(SUPPORTED_IMAGE_EXTENSIONS))
        print(f"error: unsupported image extension: {args.image.suffix}. Supported: {supported}", file=sys.stderr)
        return 1
    if not has_supported_image_signature(args.image):
        print(f"error: file does not look like a supported image: {args.image}", file=sys.stderr)
        return 1

    load_dotenv()
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
