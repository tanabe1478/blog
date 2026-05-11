#!/usr/bin/env python3
"""Create a new Swift Publish blog post.

This is a small bridge until the Markmesh extension exists. It follows the same
configuration stored in .markmesh/extensions/tanabe-blog.yml.
"""

from __future__ import annotations

import argparse
import datetime as dt
from pathlib import Path
import re
import sys
import unicodedata

POSTS_DIR = Path("Content/posts")


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", value).strip().lower()
    normalized = re.sub(r"\s+", "-", normalized)
    normalized = re.sub(r"[^0-9a-zA-Z\-_]+", "-", normalized)
    normalized = re.sub(r"-+", "-", normalized).strip("-")
    return normalized or dt.datetime.now().strftime("post-%Y%m%d-%H%M")


def frontmatter_date(now: dt.datetime) -> str:
    return now.strftime("%Y-%m-%d %H:%M")


def render_post(title: str, date: str, description: str, tags: list[str]) -> str:
    tag_text = ", ".join(tags) if tags else "日記"
    return (
        "---\n"
        f"date: {date}\n"
        f"description: {description}\n"
        f"tags: {tag_text}\n"
        "---\n\n"
        f"# {title}\n\n"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Create a new blog post")
    parser.add_argument("title", help="post title")
    parser.add_argument("--slug", help="file slug. Defaults to a slugified title")
    parser.add_argument("--description", default='""', help="frontmatter description")
    parser.add_argument("--tag", action="append", dest="tags", help="frontmatter tag. Can be passed multiple times")
    parser.add_argument("--date", help="frontmatter date. Defaults to now, yyyy-MM-dd HH:mm")
    args = parser.parse_args()

    slug = args.slug or slugify(args.title)
    path = POSTS_DIR / f"{slug}.md"
    if path.exists():
        print(f"error: {path} already exists", file=sys.stderr)
        return 1

    date = args.date or frontmatter_date(dt.datetime.now())
    tags = args.tags or ["日記"]
    POSTS_DIR.mkdir(parents=True, exist_ok=True)
    path.write_text(render_post(args.title, date, args.description, tags), encoding="utf-8")
    print(path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
