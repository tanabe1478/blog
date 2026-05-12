#!/usr/bin/env python3
"""Publish the blog with one command.

This script is the main authoring workflow:

1. Upload local images in posts to Gyazo and rewrite Markdown.
2. Build and check Output.
3. Commit and push source repository changes when needed.
4. Deploy Output to the public GitHub Pages repository.
"""

from __future__ import annotations

import argparse
from pathlib import Path
import subprocess
import sys


def run(command: list[str]) -> None:
    print(f"$ {' '.join(command)}")
    subprocess.run(command, check=True)


def capture(command: list[str]) -> str:
    return subprocess.check_output(command, text=True).strip()


def has_git_changes() -> bool:
    return bool(capture(["git", "status", "--porcelain"]))


def current_branch() -> str:
    return capture(["git", "branch", "--show-current"])


def ensure_repo_root() -> None:
    required = [Path("Package.swift"), Path("Content/posts"), Path("scripts/prepare_for_deploy.py")]
    missing = [str(path) for path in required if not path.exists()]
    if missing:
        raise RuntimeError(f"run this script from the blog repository root. missing: {', '.join(missing)}")


def commit_and_push(message: str, skip_push: bool) -> None:
    if not has_git_changes():
        print("No source changes to commit.")
        return

    run(["git", "add", "-A"])
    run(["git", "commit", "-m", message])
    if not skip_push:
        run(["git", "push", "origin", current_branch()])


def main() -> int:
    parser = argparse.ArgumentParser(description="Upload images, build, commit, push, and deploy the blog")
    parser.add_argument(
        "--message",
        default="post: sync blog content",
        help="source repository commit message when there are changes",
    )
    parser.add_argument("--skip-source-push", action="store_true", help="commit source changes but do not push them")
    parser.add_argument("--skip-deploy", action="store_true", help="prepare, commit, and push source only")
    parser.add_argument("--skip-public-check", action="store_true", help="deploy without public smoke check")
    parser.add_argument("--dry-run", action="store_true", help="show image replacements without writing, committing, or deploying")
    args = parser.parse_args()

    try:
        ensure_repo_root()

        if args.dry_run:
            run(["scripts/prepare_for_deploy.py", "--dry-run", "--skip-build"])
            return 0

        run(["scripts/prepare_for_deploy.py"])
        commit_and_push(args.message, args.skip_source_push)

        if args.skip_deploy:
            return 0

        deploy_command = ["scripts/deploy_site.sh", "--skip-prepare"]
        if not args.skip_public_check:
            deploy_command.append("--check")
        run(deploy_command)
        return 0
    except subprocess.CalledProcessError as error:
        return error.returncode
    except Exception as error:  # noqa: BLE001 - CLI should print friendly errors.
        print(f"error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
