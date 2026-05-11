#!/usr/bin/env bash
set -euo pipefail

run_check=false
if [[ "${1:-}" == "--check" ]]; then
  run_check=true
  shift
fi

remote="${BLOG_DEPLOY_REMOTE:-git@github.com:tanabe1478/tanabe1478.github.io.git}"
branch="${BLOG_DEPLOY_BRANCH:-master}"
workdir="$(mktemp -d)"
repo_root="$(pwd)"

cleanup() {
  rm -rf "$workdir"
}
trap cleanup EXIT

scripts/prepare_for_deploy.py

git clone --depth 1 --branch "$branch" "$remote" "$workdir/site"
rsync -a --delete --exclude .git Output/ "$workdir/site/"

cd "$workdir/site"
if git diff --quiet --cached && git diff --quiet && [ -z "$(git ls-files --others --exclude-standard)" ]; then
  echo "No deployment changes."
else
  git add -A
  git commit -m "Publish site"
  git push origin "$branch"
fi

if [[ "$run_check" == true ]]; then
  cd "$repo_root"
  for attempt in 1 2 3 4 5; do
    echo "Running public smoke check (attempt $attempt/5)..."
    if scripts/check_public_site.py; then
      exit 0
    fi
    sleep 15
  done
  echo "Public smoke check failed after deploy." >&2
  exit 1
fi
