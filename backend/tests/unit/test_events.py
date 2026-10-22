import asyncio

from overworked.events import changes


def states(*values):
    """load() returning one value per poll."""
    remaining = list(values)

    async def load():
        return remaining.pop(0)

    return load


async def no_wait():
    pass


def take(n, iterator):
    async def collect():
        return [await anext(iterator) for _ in range(n)]

    return asyncio.run(collect())


def test_sends_the_current_state_right_away():
    assert take(1, changes(states("a"), no_wait)) == ["a"]


def test_sends_only_what_changed():
    events = changes(states("a", "a", "b", "b", "a"), no_wait, keepalive_every=100)

    assert take(3, events) == ["a", "b", "a"]


def test_sends_a_keepalive_while_nothing_changes():
    events = changes(states("a", "a", "a", "a", "a", "b"), no_wait, keepalive_every=2)

    assert take(4, events) == ["a", None, None, "b"]
