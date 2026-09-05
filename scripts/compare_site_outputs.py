#!/usr/bin/env python3
"""Compare two generated static sites byte for byte.

During the MoonBit migration, the current Publish output is the reference and
MoonBit output is the candidate. Keeping this check independent from either
SSG makes differences observable before deployment is switched over.
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
import hashlib
from pathlib import Path
import sys


@dataclass(frozen=True)
class ChangedFile:
    path: str
    reference_size: int
    candidate_size: int
    first_difference: int
    reference_sha256: str
    candidate_sha256: str


@dataclass(frozen=True)
class OutputComparison:
    missing_from_candidate: tuple[str, ...]
    extra_in_candidate: tuple[str, ...]
    changed: tuple[ChangedFile, ...]
    matching_files: int

    @property
    def matches(self) -> bool:
        return not self.missing_from_candidate and not self.extra_in_candidate and not self.changed


def generated_files(root: Path) -> dict[str, Path]:
    return {
        path.relative_to(root).as_posix(): path
        for path in root.rglob("*")
        if path.is_file()
    }


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def first_different_byte(reference: bytes, candidate: bytes) -> int:
    for offset, (reference_byte, candidate_byte) in enumerate(zip(reference, candidate)):
        if reference_byte != candidate_byte:
            return offset
    return min(len(reference), len(candidate))


def compare_outputs(reference: Path, candidate: Path) -> OutputComparison:
    reference_files = generated_files(reference)
    candidate_files = generated_files(candidate)
    reference_paths = set(reference_files)
    candidate_paths = set(candidate_files)

    shared_paths = reference_paths & candidate_paths
    changed: list[ChangedFile] = []
    matching_files = 0

    for relative_path in sorted(shared_paths):
        reference_data = reference_files[relative_path].read_bytes()
        candidate_data = candidate_files[relative_path].read_bytes()
        if reference_data == candidate_data:
            matching_files += 1
            continue

        changed.append(
            ChangedFile(
                path=relative_path,
                reference_size=len(reference_data),
                candidate_size=len(candidate_data),
                first_difference=first_different_byte(reference_data, candidate_data),
                reference_sha256=sha256(reference_data),
                candidate_sha256=sha256(candidate_data),
            )
        )

    return OutputComparison(
        missing_from_candidate=tuple(sorted(reference_paths - candidate_paths)),
        extra_in_candidate=tuple(sorted(candidate_paths - reference_paths)),
        changed=tuple(changed),
        matching_files=matching_files,
    )


def print_paths(heading: str, paths: tuple[str, ...], limit: int) -> None:
    if not paths:
        return
    print(f"{heading} ({len(paths)}):")
    for path in paths[:limit]:
        print(f"  - {path}")
    if len(paths) > limit:
        print(f"  ... and {len(paths) - limit} more")


def print_comparison(comparison: OutputComparison, limit: int) -> None:
    if comparison.matches:
        print(f"PARITY OK: {comparison.matching_files} files are byte-identical")
        return

    print("PARITY FAILED")
    print(f"matching files: {comparison.matching_files}")
    print_paths("missing from candidate", comparison.missing_from_candidate, limit)
    print_paths("extra in candidate", comparison.extra_in_candidate, limit)

    if comparison.changed:
        print(f"different file contents ({len(comparison.changed)}):")
        for changed in comparison.changed[:limit]:
            print(
                f"  - {changed.path}: first difference at byte {changed.first_difference}; "
                f"reference={changed.reference_size} bytes sha256={changed.reference_sha256[:12]}; "
                f"candidate={changed.candidate_size} bytes sha256={changed.candidate_sha256[:12]}"
            )
        if len(comparison.changed) > limit:
            print(f"  ... and {len(comparison.changed) - limit} more")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Compare a reference static-site output and a candidate byte for byte"
    )
    parser.add_argument("reference", type=Path, help="reference output directory (Publish during migration)")
    parser.add_argument("candidate", type=Path, help="candidate output directory (MoonBit during migration)")
    parser.add_argument("--limit", type=int, default=20, help="maximum differences to print per category")
    args = parser.parse_args()

    for label, directory in (("reference", args.reference), ("candidate", args.candidate)):
        if not directory.is_dir():
            print(f"error: {label} output directory not found: {directory}", file=sys.stderr)
            return 2
    if args.limit < 1:
        print("error: --limit must be at least 1", file=sys.stderr)
        return 2

    comparison = compare_outputs(args.reference, args.candidate)
    print_comparison(comparison, args.limit)
    return 0 if comparison.matches else 1


if __name__ == "__main__":
    sys.exit(main())
