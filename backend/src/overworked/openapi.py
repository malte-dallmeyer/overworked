"""Writes the OpenAPI spec the frontend client is generated from.

Usage: uv run python -m overworked.openapi <output-file>
"""

import json
import sys
from pathlib import Path

from overworked.config import Settings
from overworked.main import create_app


def build_spec() -> dict:
    app = create_app(Settings(database_url="sqlite://"), run_alarm_loop=False)
    return app.openapi()


if __name__ == "__main__":
    spec = json.dumps(build_spec(), indent=2, ensure_ascii=False)
    Path(sys.argv[1]).write_text(spec + "\n")
