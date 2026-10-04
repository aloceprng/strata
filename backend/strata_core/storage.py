from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Protocol

class ArtifactStore(Protocol):
    def write(self, path: str, content: str) -> "StoredArtifact": ...

    def url_for(self, path: str) -> str: ...

class StoredArtifact:
    def __init__(self, path: str, url: str, size: int, checksum: str):
        self.path = path
        self.url = url
        self.size = size
        self.checksum = checksum

    def __repr__(self) -> str:
        return f"<StoredArtifact {self.path} {self.size}B {self.checksum[:8]}>"

class LocalArtifactStore:
    def __init__(self, root: Path | str, base_url: str = "/artifacts"):
        self.root = Path(root)
        self.base_url = base_url.rstrip("/")

    def write(self, path: str, content: str) -> StoredArtifact:
        target = self.root / path
        target.parent.mkdir(parents=True, exist_ok=True)
        data = content.encode("utf-8")
        target.write_bytes(data)
        return StoredArtifact(
            path=path,
            url=self.url_for(path),
            size=len(data),
            checksum=hashlib.sha256(data).hexdigest(),
        )

    def url_for(self, path: str) -> str:
        return f"{self.base_url}/{path}"

def versioned_path(brand: str, version: str, filename: str) -> str:
    return f"{brand}/{version}/{filename}"
