#!/usr/bin/env python3
"""Build the blog with Swift Publish and MoonBit, then compare all outputs."""

from __future__ import annotations

import argparse
from email.utils import parsedate_to_datetime
import os
from pathlib import Path
import re
import subprocess
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from compare_site_outputs import compare_outputs, print_comparison  # noqa: E402

LAST_BUILD_DATE = re.compile(r"<lastBuildDate>([^<]+)</lastBuildDate>")


def reference_build_date(feed_path: Path) -> str:
    """Return Publish's RSS build time in the MoonBit CLI format."""
    match = LAST_BUILD_DATE.search(feed_path.read_text(encoding="utf-8"))
    if match is None:
        raise ValueError(f"lastBuildDate not found in {feed_path}")
    date = parsedate_to_datetime(match.group(1))
    return date.strftime("%Y-%m-%dT%H:%M:%S%z")


def run(command: list[str], *, cwd: Path | None = None) -> None:
    location = f" (cwd: {cwd})" if cwd else ""
    print(f"$ {' '.join(command)}{location}")
    subprocess.run(command, cwd=cwd, check=True)


def ensure_inputs(ssg_dir: Path, reference: Path, candidate: Path) -> None:
    if not (ssg_dir / "moon.mod").is_file() or not (ssg_dir / "cmd/main").is_dir():
        raise ValueError(f"MoonBit SSG repository not found: {ssg_dir}")
    if not Path("Content/posts").is_dir() or not Path("Resources").is_dir():
        raise ValueError("run this script from the blog repository root")
    if reference.resolve() == candidate.resolve():
        raise ValueError("reference and candidate directories must be different")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Build Swift and MoonBit outputs and compare all generated files"
    )
    parser.add_argument(
        "--ssg-dir",
        type=Path,
        default=Path(os.environ.get("MOONBIT_SSG_DIR", "../moonbit-ssg")),
        help="moonbit-ssg checkout (default: ../moonbit-ssg or MOONBIT_SSG_DIR)",
    )
    parser.add_argument("--reference", type=Path, default=Path("Output"))
    parser.add_argument("--candidate", type=Path, default=Path("Output.moonbit"))
    parser.add_argument(
        "--skip-swift-build",
        action="store_true",
        help="reuse the existing reference output",
    )
    parser.add_argument("--keep-candidate", action="store_true")
    parser.add_argument("--limit", type=int, default=20)
    args = parser.parse_args()

    try:
        ssg_dir = args.ssg_dir.resolve()
        reference = args.reference.resolve()
        candidate = args.candidate.resolve()
        ensure_inputs(ssg_dir, reference, candidate)

        if not args.skip_swift_build:
            run(["swift", "run"])
        if not reference.is_dir():
            raise ValueError(f"reference output directory not found: {reference}")

        build_date = reference_build_date(reference / "feed.rss")
        run(["mise", "exec", "--", "moon", "update"], cwd=ssg_dir)
        run(
            [
                "mise",
                "exec",
                "--",
                "moon",
                "run",
                "cmd/main",
                "--",
                "build",
                str(Path("Content").resolve()),
                str(Path("Resources").resolve()),
                str(candidate),
                build_date,
            ],
            cwd=ssg_dir,
        )

        comparison = compare_outputs(reference, candidate)
        print_comparison(comparison, args.limit)
        return 0 if comparison.matches else 1
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        print(f"error: {error}", file=sys.stderr)
        return error.returncode if isinstance(error, subprocess.CalledProcessError) else 2
    finally:
        if "candidate" in locals() and not args.keep_candidate:
            import shutil

            shutil.rmtree(candidate, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
