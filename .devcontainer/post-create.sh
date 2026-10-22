#!/usr/bin/env bash
set -euo pipefail

curl -LsSf https://astral.sh/uv/0.8.3/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"

node scripts/setup.mjs
(cd e2e && npx playwright install-deps chromium)
