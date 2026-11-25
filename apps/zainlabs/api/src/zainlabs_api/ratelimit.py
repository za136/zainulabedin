"""In-memory sliding-window rate limit per client key (IP). IPs are held in memory only, never stored."""
from __future__ import annotations

import time
from collections import defaultdict, deque


class RateLimiter:
    def __init__(self, limit: int, window_seconds: int, clock=time.monotonic):
        self.limit, self.window, self.clock = limit, window_seconds, clock
        self.hits: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str) -> int | None:
        """Returns None if allowed, else seconds until the next request is allowed."""
        now = self.clock()
        q = self.hits[key]
        while q and now - q[0] >= self.window:
            q.popleft()
        if len(q) >= self.limit:
            return max(1, int(self.window - (now - q[0])))
        q.append(now)
        return None
