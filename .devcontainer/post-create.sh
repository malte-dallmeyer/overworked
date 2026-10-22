#!/usr/bin/env bash
set -euo pipefail

curl -LsSf https://astral.sh/uv/0.8.3/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"

scripts/setup.sh
(cd e2e && npx playwright install-deps chromium)
