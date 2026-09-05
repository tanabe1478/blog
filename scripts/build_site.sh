#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
ssg_dir="${MOONBIT_SSG_DIR:-$repo_root/../moonbit-ssg}"
expected_revision="$(tr -d '[:space:]' < "$repo_root/.moonbit-ssg-revision")"
output_dir="${BLOG_OUTPUT_DIR:-$repo_root/Output}"

if [[ ! -f "$ssg_dir/moon.mod" || ! -d "$ssg_dir/cmd/main" ]]; then
  echo "MoonBit SSG repository not found: $ssg_dir" >&2
  echo "Clone https://github.com/tanabe1478/moonbit-ssg or set MOONBIT_SSG_DIR." >&2
  exit 1
fi

if [[ "${MOONBIT_SSG_ALLOW_UNPINNED:-false}" != "true" ]]; then
  actual_revision="$(git -C "$ssg_dir" rev-parse HEAD 2>/dev/null || true)"
  if [[ "$actual_revision" != "$expected_revision" ]]; then
    echo "MoonBit SSG revision mismatch." >&2
    echo "expected: $expected_revision" >&2
    echo "actual:   ${actual_revision:-unknown}" >&2
    echo "Checkout the expected revision or set MOONBIT_SSG_ALLOW_UNPINNED=true for development." >&2
    exit 1
  fi
fi

command=(
  mise exec -- moon run cmd/main -- build
  "$repo_root/Content"
  "$repo_root/Resources"
  "$output_dir"
)
if [[ $# -gt 1 ]]; then
  echo "usage: scripts/build_site.sh [BUILD_DATE]" >&2
  exit 1
fi
if [[ $# -eq 1 ]]; then
  command+=("$1")
fi

(
  cd "$ssg_dir"
  mise exec -- moon update
  "${command[@]}"
)
