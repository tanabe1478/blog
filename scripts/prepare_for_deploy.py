#!/usr/bin/env python3
"""Prepare the blog for deploy.

Replace local drafting images with Gyazo URLs, then build and check the site.
"""

from __future__ import annotations

import argparse
from pathlib import Path
import subprocess
import sys

# Import sibling helper without making scripts a package.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from replace_local_images_with_gyazo import DEFAULT_TARGET_PREFIXES, replace_images  # noqa: E402


def markdown_files(posts_dir: Path) -> list[Path]:
    return sorted(posts_dir.glob("*.md"))


def run(command: list[str]) -> None:
    subprocess.run(command, check=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="Prepare blog content for deploy")
    parser.add_argument("--posts-dir", type=Path, default=Path("Content/posts"))
    parser.add_argument("--dry-run", action="store_true", help="show image replacements without uploading or writing")
    parser.add_argument("--skip-images", action="store_true", help="skip local image replacement")
    parser.add_argument("--skip-build", action="store_true", help="skip swift run")
    parser.add_argument("--skip-output-check", action="store_true", help="skip generated Output asset check")
    parser.add_argument(
        "--prefix",
        action="append",
        dest="prefixes",
        help="local image path prefix to upload. Can be passed multiple times",
    )
    args = parser.parse_args()

    if not args.posts_dir.is_dir():
        print(f"error: posts directory not found: {args.posts_dir}", file=sys.stderr)
        return 1

    total_replacements = 0
    if not args.skip_images:
        prefixes = tuple(args.prefixes or DEFAULT_TARGET_PREFIXES)
        for path in markdown_files(args.posts_dir):
            total_replacements += replace_images(path, prefixes, args.dry_run)

    if args.dry_run:
        print(f"prepare dry-run replacements={total_replacements}")
        return 0

    if not args.skip_build:
        run(["swift", "run"])
        if not args.skip_output_check:
            run(["scripts/check_output_site.py"])

    print(f"prepare complete replacements={total_replacements}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
