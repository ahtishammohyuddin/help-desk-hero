"""Rate limiting and caching for AI calls. Both are in memory, which suits a
single small server (Render free tier). If the server restarts, they reset.
"""

from __future__ import annotations

import time
from collections import defaultdict, deque
from datetime import date
from typing import Callable


class RateLimiter:
    """Allows each client at most `per_client` AI calls per `window` seconds,
    and the whole server at most `daily_total` AI calls per day.

    When a limit is hit, the caller uses fallback text (the game still works).
    """

    def __init__(
        self,
        per_client: int = 20,
        window: float = 600.0,
        daily_total: int = 300,
        clock: Callable[[], float] = time.monotonic,
        today: Callable[[], date] = date.today,
    ):
        self.per_client = per_client
        self.window = window
        self.daily_total = daily_total
        self._clock = clock
        self._today = today
        self._calls: dict[str, deque[float]] = defaultdict(deque)
        self._day = today()
        self._day_count = 0

    def allow(self, client_id: str) -> bool:
        now = self._clock()
        if self._today() != self._day:
            self._day, self._day_count = self._today(), 0
        if self._day_count >= self.daily_total:
            return False

        calls = self._calls[client_id]
        while calls and now - calls[0] >= self.window:
            calls.popleft()
        if len(calls) >= self.per_client:
            return False

        calls.append(now)
        self._day_count += 1
        return True

    @property
    def used_today(self) -> int:
        return self._day_count


class TTLCache:
    """A small dictionary whose entries expire after `ttl` seconds."""

    def __init__(self, ttl: float = 86400.0, max_items: int = 2000, clock: Callable[[], float] = time.monotonic):
        self.ttl = ttl
        self.max_items = max_items
        self._clock = clock
        self._data: dict[object, tuple[float, object]] = {}

    def get(self, key: object) -> object | None:
        item = self._data.get(key)
        if item is None:
            return None
        stored_at, value = item
        if self._clock() - stored_at >= self.ttl:
            del self._data[key]
            return None
        return value

    def set(self, key: object, value: object) -> None:
        if len(self._data) >= self.max_items and key not in self._data:
            oldest = min(self._data, key=lambda k: self._data[k][0])
            del self._data[oldest]
        self._data[key] = (self._clock(), value)

    def __len__(self) -> int:
        return len(self._data)
