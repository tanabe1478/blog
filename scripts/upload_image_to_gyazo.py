#!/usr/bin/env python3
"""Upload an image to Gyazo and print Markdown.

The access token is read from GYAZO_ACCESS_TOKEN so it is never stored in this repository.
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path
import sys

from gyazo_upload_core import (
    SUPPORTED_IMAGE_EXTENSIONS,
    has_supported_image_signature,
    markdown_for,
    upload,
)


def load_dotenv(path: Path = Path(".env")) -> None:
    if not path.is_file():
        return

    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


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
