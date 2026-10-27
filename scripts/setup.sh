#!/usr/bin/env bash
set -euo pipefail
cd /workspace/ilovekush
export NPM_CONFIG_CACHE=/workspace/ilovekush/.data/cache/npm
export PIP_CACHE_DIR=/workspace/ilovekush/.data/cache/pip
npm ci --no-audit --no-fund
if [ ! -x .venv/bin/python ]; then
  python3 -m venv --system-site-packages .venv
fi
.venv/bin/python -m pip install --disable-pip-version-check -r requirements-full.txt
.venv/bin/python scripts/setup-python.py
.venv/bin/python scripts/install-verapdf.py
npm run build
