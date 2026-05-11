#!/usr/bin/env python3
"""Check generated Output/ HTML for missing local assets."""

from __future__ import annotations

import argparse
from pathlib import Path
import re
import sys

IMG_PATTERN = re.compile(r'<img[^>]+src="([^"]+)"')
LINK_PATTERN = re.compile(r'<link[^>]+href="([^"]+)"')
SCRIPT_PATTERN = re.compile(r'<script[^>]+src="([^"]+)"')


def local_asset_targets(html: str) -> list[str]:
    targets: list[str] = []
    for pattern in (IMG_PATTERN, LINK_PATTERN, SCRIPT_PATTERN):
        for target in pattern.findall(html):
            if target.startswith("/"):
                targets.append(target)
    return targets


def check_output(output_dir: Path) -> list[str]:
    errors: list[str] = []
    if not output_dir.is_dir():
        return [f"output directory not found: {output_dir}"]

    for html_path in sorted(output_dir.rglob("*.html")):
        html = html_path.read_text(encoding="utf-8", errors="replace")
        for target in local_asset_targets(html):
            asset_path = output_dir / target.lstrip("/")
            if not asset_path.exists():
                relative_html = html_path.relative_to(output_dir)
                errors.append(f"{relative_html}: missing asset {target}")

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description="Check generated Output/ HTML for missing local assets")
    parser.add_argument("--output-dir", type=Path, default=Path("Output"))
    args = parser.parse_args()

    errors = check_output(args.output_dir)
    if errors:
        print("Missing local assets:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print(f"OK local assets in {args.output_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
