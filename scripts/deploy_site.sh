#!/usr/bin/env bash
set -euo pipefail

remote="${BLOG_DEPLOY_REMOTE:-git@github.com:tanabe1478/tanabe1478.github.io.git}"
branch="${BLOG_DEPLOY_BRANCH:-master}"
workdir="$(mktemp -d)"

cleanup() {
  rm -rf "$workdir"
}
trap cleanup EXIT

swift run

git clone --depth 1 --branch "$branch" "$remote" "$workdir/site"
rsync -a --delete --exclude .git Output/ "$workdir/site/"

cd "$workdir/site"
if git diff --quiet --cached && git diff --quiet && [ -z "$(git ls-files --others --exclude-standard)" ]; then
  echo "No deployment changes."
  exit 0
fi

git add -A
git commit -m "Publish site"
git push origin "$branch"
