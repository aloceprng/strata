from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .graph import dependencies
from .parse import Token, parse
from .resolver import ResolvedSet, ResolvedToken, resolve

ADDED, REMOVED, CHANGED = "added", "removed", "changed"
DIRECT, CASCADE = "direct", "cascade"

@dataclass(frozen=True)
class Change:
    path: str
    kind: str
    before: ResolvedToken | None = None
    after: ResolvedToken | None = None
    authored_before: Any = None
    authored_after: Any = None
    cause: str | None = None
    upstream: tuple[str, ...] = ()

    @property
    def layer(self) -> str:
        return self.path.split(".", 1)[0]

    @property
    def type_changed(self) -> bool:
        return self.kind == CHANGED and self.before.type != self.after.type

    @property
    def value_changed(self) -> bool:

        return self.kind == CHANGED and self.before.value != self.after.value

@dataclass
class Diff:
    changes: list[Change]

    def of_kind(self, kind: str) -> list[Change]:
        return [c for c in self.changes if c.kind == kind]

    @property
    def added(self) -> list[Change]:
        return self.of_kind(ADDED)

    @property
    def removed(self) -> list[Change]:
        return self.of_kind(REMOVED)

    @property
    def changed(self) -> list[Change]:
        return self.of_kind(CHANGED)

    def __len__(self) -> int:
        return len(self.changes)

    def __bool__(self) -> bool:
        return bool(self.changes)

def diff_documents(before: dict, after: dict) -> Diff:
    before_tokens, after_tokens = parse(before), parse(after)
    return diff(before_tokens, resolve(before_tokens), after_tokens, resolve(after_tokens))

def diff(before_tokens: dict[str, Token], before: ResolvedSet,
         after_tokens: dict[str, Token], after: ResolvedSet) -> Diff:

    old, new = before.tokens, after.tokens
    changes: list[Change] = []

    for path in old.keys() - new.keys():
        changes.append(Change(path, REMOVED, before=old[path],
                              authored_before=before_tokens[path].value))
    for path in new.keys() - old.keys():
        changes.append(Change(path, ADDED, after=new[path],
                              authored_after=after_tokens[path].value))

    direct: set[str] = set()
    cascaded: list[str] = []
    for path in old.keys() & new.keys():
        was, now = before_tokens[path], after_tokens[path]
        if was.value != now.value or was.type != now.type:
            direct.add(path)
        elif old[path].value != new[path].value or old[path].type != new[path].type:
            cascaded.append(path)

    for path in direct:
        changes.append(_changed(path, DIRECT, old, new, before_tokens, after_tokens))

    sources = _direct_sources(dependencies(after_tokens), direct)
    for path in cascaded:
        changes.append(_changed(path, CASCADE, old, new, before_tokens, after_tokens,
                                upstream=tuple(sorted(sources[path]))))

    changes.sort(key=lambda c: c.path)
    return Diff(changes)

def _changed(path, cause, old, new, before_tokens, after_tokens, upstream=()) -> Change:
    return Change(
        path, CHANGED,
        before=old[path], after=new[path],
        authored_before=before_tokens[path].value,
        authored_after=after_tokens[path].value,
        cause=cause, upstream=upstream,
    )

def _direct_sources(deps: dict[str, list[str]], direct: set[str]) -> dict[str, set[str]]:

    sources: dict[str, set[str]] = {}

    for start in deps:
        stack = [start]
        while stack:
            node = stack[-1]
            if node in sources:
                stack.pop()
                continue
            pending = [ref for ref in deps[node] if ref not in sources]
            if pending:
                stack.extend(pending)
                continue
            found: set[str] = set()
            for ref in deps[node]:
                if ref in direct:
                    found.add(ref)
                found |= sources[ref]
            sources[node] = found
            stack.pop()

    return sources
