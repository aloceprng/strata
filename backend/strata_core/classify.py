from __future__ import annotations

from dataclasses import dataclass, field

from .diff import ADDED, CASCADE, REMOVED, Change, Diff

PATCH, MINOR, MAJOR = "patch", "minor", "major"
RANK = {PATCH: 0, MINOR: 1, MAJOR: 2}

@dataclass(frozen=True)
class Classified:
    change: Change
    severity: str
    reason: str

    @property
    def path(self) -> str:
        return self.change.path

@dataclass
class Report:
    items: list[Classified]
    by_source: dict[str, list[Classified]] = field(default_factory=dict)

    @property
    def severity(self) -> str | None:

        if not self.items:
            return None
        return max((item.severity for item in self.items), key=RANK.__getitem__)

    def of_severity(self, severity: str) -> list[Classified]:
        return [item for item in self.items if item.severity == severity]

    def counts(self) -> dict[str, int]:
        return {s: len(self.of_severity(s)) for s in (MAJOR, MINOR, PATCH)}

def classify(change: Change) -> Classified:
    if change.kind == ADDED:
        return Classified(change, MINOR, "added; nothing existing depends on it")

    if change.kind == REMOVED:
        if change.layer == "primitive":
            return Classified(change, MINOR, "primitive removed; primitives are outside the contract")
        return Classified(change, MAJOR, "removed; anything using it breaks")

    if change.type_changed:
        return Classified(
            change, MAJOR,
            f"type changed from {change.before.type} to {change.after.type}; "
            f"code expecting a {change.before.type} breaks",
        )

    if not change.value_changed:
        return Classified(change, PATCH, "reference moved, value unchanged; no visible change")

    if change.cause == CASCADE:
        return Classified(change, PATCH, f"value changed via {', '.join(change.upstream)}")
    return Classified(change, PATCH, "value changed")

def classify_diff(diff: Diff) -> Report:
    items = [classify(change) for change in diff.changes]

    by_source: dict[str, list[Classified]] = {
        item.path: [] for item in items if item.change.cause not in (None, CASCADE)
    }
    for item in items:
        for source in item.change.upstream:
            by_source.setdefault(source, []).append(item)

    return Report(items=items, by_source=by_source)
