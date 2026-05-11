#!/usr/bin/env python3
"""Migrate tanabe1478/diary GitHub Issues into Swift Publish posts.

This script intentionally does one small job: fetch normal GitHub Issues
(excluding Pull Requests) and create Content/posts/diary-{number}.md files.
Existing files are not overwritten unless --overwrite is passed.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
from pathlib import Path
import sys
import urllib.error
import urllib.request

REPOSITORY = "tanabe1478/diary"
API_URL = f"https://api.github.com/repos/{REPOSITORY}/issues"


def fetch_issues(token: str | None) -> list[dict]:
    issues: list[dict] = []
    page = 1

    while True:
        url = f"{API_URL}?state=all&per_page=100&page={page}"
        headers = {
            "Accept": "application/vnd.github+json",
            "User-Agent": "tanabe1478-blog-migration",
        }
        if token:
            headers["Authorization"] = f"Bearer {token}"

        request = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                page_items = json.load(response)
        except urllib.error.HTTPError as error:
            message = error.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"GitHub API request failed: {error.code} {message}") from error

        if not page_items:
            break

        issues.extend(page_items)
        page += 1

    return [issue for issue in issues if "pull_request" not in issue]


def frontmatter_date(created_at: str) -> str:
    created = dt.datetime.fromisoformat(created_at.replace("Z", "+00:00"))
    return created.strftime("%Y-%m-%d %H:%M")


def yaml_escape(value: str) -> str:
    return value.replace('"', '\\"')


def render_issue(issue: dict) -> str:
    title = issue["title"]
    body = issue.get("body") or ""
    date = frontmatter_date(issue["created_at"])

    return (
        "---\n"
        f"date: {date}\n"
        "description: \"\"\n"
        "tags: diary\n"
        "---\n\n"
        f"# {title}\n\n"
        f"{body.rstrip()}\n"
    )


def write_issues(issues: list[dict], posts_dir: Path, overwrite: bool, dry_run: bool) -> tuple[int, int]:
    created = 0
    skipped = 0
    posts_dir.mkdir(parents=True, exist_ok=True)

    for issue in sorted(issues, key=lambda item: item["number"]):
        path = posts_dir / f"diary-{issue['number']}.md"
        if path.exists() and not overwrite:
            skipped += 1
            print(f"skip existing {path}")
            continue

        print(f"write {path}")
        if not dry_run:
            path.write_text(render_issue(issue), encoding="utf-8")
        created += 1

    return created, skipped


def main() -> int:
    parser = argparse.ArgumentParser(description="Migrate diary GitHub Issues into Content/posts")
    parser.add_argument("--posts-dir", default="Content/posts", help="directory for generated Publish posts")
    parser.add_argument("--overwrite", action="store_true", help="overwrite existing diary-{number}.md files")
    parser.add_argument("--dry-run", action="store_true", help="show what would be written without creating files")
    parser.add_argument("--token", default=os.environ.get("GITHUB_TOKEN"), help="GitHub token, defaults to GITHUB_TOKEN")
    args = parser.parse_args()

    issues = fetch_issues(args.token)
    created, skipped = write_issues(
        issues=issues,
        posts_dir=Path(args.posts_dir),
        overwrite=args.overwrite,
        dry_run=args.dry_run,
    )

    print(f"issues={len(issues)} created={created} skipped={skipped} dry_run={args.dry_run}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
