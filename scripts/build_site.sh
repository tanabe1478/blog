#!/usr/bin/env bash
# Generate Output/ with this repository's generator (site/) and the pinned
# moonbit-ssg submodule (vendor/moonbit-ssg), both members of moon.work.
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
output_dir="${BLOG_OUTPUT_DIR:-$repo_root/Output}"

if [[ $# -gt 1 ]]; then
  echo "usage: scripts/build_site.sh [BUILD_DATE]" >&2
  exit 1
fi

if [[ ! -f "$repo_root/vendor/moonbit-ssg/moon.mod" ]]; then
  echo "vendor/moonbit-ssg is not checked out." >&2
  echo "Run: git submodule update --init" >&2
  exit 1
fi

command=(
  mise exec -- moon run site/cmd/build --
  "$repo_root/Content"
  "$repo_root/Resources"
  "$repo_root/design/tokens.json"
  "$output_dir"
)
if [[ $# -eq 1 ]]; then
  command+=("$1")
fi

(
  cd "$repo_root"
  mise exec -- moon update
  "${command[@]}"
  # Highlight code and draw mermaid diagrams to SVG (scripts/highlight).
  if [[ ! -d scripts/highlight/node_modules ]]; then
    mise exec -- npm ci --prefix scripts/highlight --no-audit --no-fund
  fi
  # Chromium draws the diagrams; this is quick when it is already installed.
  mise exec -- npm exec --prefix scripts/highlight -- playwright install chromium
  mise exec -- node scripts/highlight/build.mjs "$output_dir"
)
