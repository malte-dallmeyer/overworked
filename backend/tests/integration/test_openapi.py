import json
from pathlib import Path

from overworked.openapi import build_spec

COMMITTED_SPEC = Path(__file__).parents[3] / "openapi.json"


def test_operations_are_named_after_their_functions():
    spec = build_spec()

    operation_ids = {op["operationId"] for path in spec["paths"].values() for op in path.values()}

    assert operation_ids == {
        "health",
        "get_current_session",
        "start_session",
        "pause_session",
        "resume_session",
        "end_session",
        "add_pause",
        "change_pause",
        "remove_pause",
    }


def test_committed_spec_is_up_to_date():
    """The frontend client is generated from openapi.json; regenerate with
    `node scripts/generate-api.mjs` after changing the API."""
    assert json.loads(COMMITTED_SPEC.read_text()) == build_spec()
