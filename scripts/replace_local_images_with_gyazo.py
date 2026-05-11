#!/usr/bin/env python3
"""Replace local Markdown image links with Gyazo URLs.

This is a temporary bridge for the future Markmesh `Prepare for Deploy` command.
It only targets explicitly local drafting image paths, not existing public assets.
"""

from __future__ import annotations

import argparse
from pathlib import Path
import re
import sys

# Import sibling helpers without making scripts a package.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from gyazo_upload_core import markdown_for, upload  # noqa: E402
from upload_image_to_gyazo import load_dotenv  # noqa: E402

IMAGE_PATTERN = re.compile(r"(?P<prefix>!\[(?P<alt>[^\]]*)\]\()(?P<target>[^)]+)(?P<suffix>\))")
DEFAULT_TARGET_PREFIXES = ("attachments/", ".markmesh/blog-assets/")


def is_target_local_image(target: str, prefixes: tuple[str, ...]) -> bool:
    if target.startswith(("http://", "https://", "/", "#")):
        return False
    return target.startswith(prefixes)


def replace_images(markdown_path: Path, prefixes: tuple[str, ...], dry_run: bool) -> int:
    content = markdown_path.read_text(encoding="utf-8")
    replacements: list[tuple[str, str]] = []

    for match in IMAGE_PATTERN.finditer(content):
        target = match.group("target")
        if not is_target_local_image(target, prefixes):
            continue

        image_path = (markdown_path.parent / target).resolve()
        if not image_path.is_file():
            raise FileNotFoundError(f"{markdown_path}: image not found: {target}")

        alt = match.group("alt") or image_path.stem
        if dry_run:
            replacement = f"[dry-run gyazo image for {target}]"
        else:
            result = upload(image_path, token_from_env())
            replacement = markdown_for(result, alt, linked=True)

        original = match.group(0)
        replacements.append((original, replacement))
        print(f"{markdown_path}: {target} -> {replacement}")

    if not replacements:
        return 0

    updated = content
    for original, replacement in replacements:
        updated = updated.replace(original, replacement, 1)

    if not dry_run:
        markdown_path.write_text(updated, encoding="utf-8")

    return len(replacements)


def token_from_env() -> str:
    import os

    load_dotenv()
    token = os.environ.get("GYAZO_ACCESS_TOKEN")
    if not token:
        raise RuntimeError("GYAZO_ACCESS_TOKEN is not set")
    return token


def main() -> int:
    parser = argparse.ArgumentParser(description="Replace local Markdown images with Gyazo URLs")
    parser.add_argument("files", nargs="+", type=Path, help="Markdown files to update")
    parser.add_argument(
        "--prefix",
        action="append",
        dest="prefixes",
        help="local image path prefix to upload. Can be passed multiple times",
    )
    parser.add_argument("--dry-run", action="store_true", help="show replacements without uploading or writing")
    args = parser.parse_args()

    prefixes = tuple(args.prefixes or DEFAULT_TARGET_PREFIXES)
    total = 0
    for path in args.files:
        if not path.is_file():
            print(f"error: Markdown file not found: {path}", file=sys.stderr)
            return 1
        total += replace_images(path, prefixes, args.dry_run)

    print(f"replacements={total} dry_run={args.dry_run}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
