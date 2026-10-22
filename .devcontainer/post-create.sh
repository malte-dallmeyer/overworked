#!/usr/bin/env bash
set -euo pipefail

curl -LsSf https://astral.sh/uv/0.8.3/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"

[ -f .env ] || cp .env.example .env

npm run setup
cd e2e && npx playwright install --with-deps chromium
