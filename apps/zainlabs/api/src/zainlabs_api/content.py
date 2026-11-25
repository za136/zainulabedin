"""Read-only access to content.json (exported from apps/zainlabs/content). Reloads when the file changes."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path


class ContentStore:
    def __init__(self, path: Path):
        self.path = Path(path)
        self._mtime: float | None = None
        self._data: dict = {}
        self.etag = ""

    def data(self) -> dict:
        mtime = self.path.stat().st_mtime
        if mtime != self._mtime:
            raw = self.path.read_bytes()
            data = json.loads(raw)
            if data.get("version") != 1 or not isinstance(data.get("projects"), list):
                raise ValueError(f"{self.path} is not a ZAIN LABS content bundle v1")
            self._data, self._mtime = data, mtime
            self.etag = '"' + hashlib.sha256(raw).hexdigest()[:20] + '"'
        return self._data

    def stream_slugs(self) -> set[str]:
        return {s["slug"] for s in self.data()["streams"]}

    def project_slugs(self) -> set[str]:
        return {p["slug"] for p in self.data()["projects"]}
