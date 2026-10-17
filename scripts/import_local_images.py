#!/usr/bin/env python3
"""Copy local drafting images into Resources/images and rewrite Markdown links.

Images are served from this repository through GitHub Pages instead of an
external image host. Files are named by content hash so repeated runs are
idempotent and never collide.
"""

from __future__ import annotations

import argparse
import hashlib
from pathlib import Path
import re
import shutil
import sys

IMAGE_PATTERN = re.compile(r"(?P<prefix>!\[(?P<alt>[^\]]*)\]\()(?P<target>[^)]+)(?P<suffix>\))")
DEFAULT_TARGET_PREFIXES = ("attachments/", ".markmesh/blog-assets/")
DEFAULT_IMAGES_DIR = Path("Resources/images")


def is_target_local_image(target: str, prefixes: tuple[str, ...]) -> bool:
    if target.startswith(("http://", "https://", "/", "#")):
        return False
    return target.startswith(prefixes)


def image_extension(path: Path) -> str | None:
    header = path.read_bytes()[:16]
    if header.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"
    if header.startswith(b"\xff\xd8\xff"):
        return ".jpg"
    if header.startswith((b"GIF87a", b"GIF89a")):
        return ".gif"
    if header.startswith(b"RIFF") and header[8:12] == b"WEBP":
        return ".webp"
    return None


def has_supported_image_signature(path: Path) -> bool:
    return image_extension(path) is not None


def import_images(markdown_path: Path, prefixes: tuple[str, ...], dry_run: bool, images_dir: Path) -> int:
    # newline="" keeps CRLF/LF as-is so only image references change in the diff.
    with markdown_path.open(encoding="utf-8", newline="") as file:
        content = file.read()
    slug = markdown_path.stem
    # (original markdown, replacement markdown, source file, destination file)
    replacements: list[tuple[str, str, Path, Path]] = []

    for match in IMAGE_PATTERN.finditer(content):
        target = match.group("target")
        if not is_target_local_image(target, prefixes):
            continue

        image_path = (markdown_path.parent / target).resolve()
        if not image_path.is_file():
            raise FileNotFoundError(f"{markdown_path}: image not found: {target}")
        extension = image_extension(image_path)
        if extension is None:
            raise ValueError(f"{markdown_path}: unsupported image signature: {target}")

        digest = hashlib.sha256(image_path.read_bytes()).hexdigest()[:16]
        filename = f"{digest}{extension}"
        public_url = f"/images/{slug}/{filename}"
        replacement = f"{match.group('prefix')}{public_url}{match.group('suffix')}"
        replacements.append((match.group(0), replacement, image_path, images_dir / slug / filename))
        print(f"{markdown_path}: {target} -> {public_url}")

    if dry_run or not replacements:
        return len(replacements)

    updated = content
    for original, replacement, source, destination in replacements:
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, destination)
        updated = updated.replace(original, replacement, 1)
    with markdown_path.open("w", encoding="utf-8", newline="") as file:
        file.write(updated)

    return len(replacements)


def main() -> int:
    parser = argparse.ArgumentParser(description="Copy local Markdown images into Resources/images")
    parser.add_argument("files", nargs="+", type=Path, help="Markdown files to update")
    parser.add_argument(
        "--prefix",
        action="append",
        dest="prefixes",
        help="local image path prefix to import. Can be passed multiple times",
    )
    parser.add_argument("--images-dir", type=Path, default=DEFAULT_IMAGES_DIR)
    parser.add_argument("--dry-run", action="store_true", help="show replacements without copying or writing")
    args = parser.parse_args()

    prefixes = tuple(args.prefixes or DEFAULT_TARGET_PREFIXES)
    total = 0
    for path in args.files:
        if not path.is_file():
            print(f"error: Markdown file not found: {path}", file=sys.stderr)
            return 1
        total += import_images(path, prefixes, args.dry_run, args.images_dir)

    print(f"replacements={total} dry_run={args.dry_run}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
