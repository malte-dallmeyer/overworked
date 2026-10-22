from collections.abc import Sequence
from dataclasses import dataclass

# Only this many sessions are kept: the quick choices need no more, and there is no history.
KEEP_SESSIONS = 5
# Before any session they count as two earlier starts, and fade out like any other.
DEFAULT_TARGETS = (450, 480)


@dataclass(frozen=True)
class QuickTargets:
    last: int
    choices: list[int]


def quick_targets(started: Sequence[int]) -> QuickTargets:
    """From the targets of past sessions, oldest first: the distinct values among the last
    KEEP_SESSIONS starts (sorted, so each choice keeps its place) and the latest one."""
    recent = [*DEFAULT_TARGETS, *started][-KEEP_SESSIONS:]
    return QuickTargets(last=recent[-1], choices=sorted(set(recent)))
