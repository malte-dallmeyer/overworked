from collections.abc import AsyncIterator, Awaitable, Callable


async def changes(
    load: Callable[[], Awaitable[str]],
    wait: Callable[[], Awaitable[None]],
    keepalive_every: int = 15,
) -> AsyncIterator[str | None]:
    """The state from `load()` whenever it differs from the last one sent; `None` after
    `keepalive_every` unchanged polls, so proxies keep the connection open."""
    last: str | None = None
    unchanged = 0
    while True:
        current = await load()
        if current != last:
            last, unchanged = current, 0
            yield current
        else:
            unchanged += 1
            if unchanged >= keepalive_every:
                unchanged = 0
                yield None
        await wait()
