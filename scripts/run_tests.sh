#!/usr/bin/env bash
set -euo pipefail

python3 -m unittest discover -s tests/scripts -p 'test_*.py'
scripts/prepare_for_deploy.py --skip-images
