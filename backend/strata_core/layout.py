from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from .classify import MAJOR, MINOR, PATCH, RANK
from .diff import ADDED, CHANGED, REMOVED
from .errors import LayoutError
from .resolver import ResolvedSet

SCREEN_NAME = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")

def load_contract(path: Path | str) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))

def validate_layouts(layouts: dict, contract: dict, resolved: ResolvedSet) -> None:
    if not isinstance(layouts, dict):
        raise LayoutError("layouts must be an object of screens")
    for screen, layout in layouts.items():
        _validate_screen(screen, layout, contract, resolved)

def _validate_screen(screen: str, layout: Any, contract: dict, resolved: ResolvedSet) -> None:
    if not SCREEN_NAME.match(screen):
        raise LayoutError(f"{screen!r} is not a valid screen name")
    if not isinstance(layout, dict):
        raise LayoutError(f"{screen} must be an object")
    if layout.get("schemaVersion") != contract["schemaVersion"]:
        raise LayoutError(
            f"{screen} has schema version {layout.get('schemaVersion')!r}, "
            f"expected {contract['schemaVersion']}"
        )
    if layout.get("screen") != screen:
        raise LayoutError(f"{screen} is labelled {layout.get('screen')!r}")
    sections = layout.get("sections")
    if not isinstance(sections, list):
        raise LayoutError(f"{screen} must have a list of sections")

    seen: set[str] = set()
    for position, section in enumerate(sections):
        where = f"{screen}.sections[{position}]"
        if not isinstance(section, dict):
            raise LayoutError(f"{where} must be an object")
        section_id = section.get("id")
        if not isinstance(section_id, str) or not section_id:
            raise LayoutError(f"{where} needs an id")
        if section_id in seen:
            raise LayoutError(f"{screen} uses the section id {section_id!r} twice")
        seen.add(section_id)
        _validate_section(f"{screen}.{section_id}", section, contract, resolved)

def _validate_section(where: str, section: dict, contract: dict, resolved: ResolvedSet) -> None:
    kind = section.get("type")
    definition = contract["sections"].get(kind)
    if definition is None:
        raise LayoutError(f"{where} has the unknown section type {kind!r}")

    for token in definition.get("tokens", []):
        if f"semantic.{token}" not in resolved.tokens:
            raise LayoutError(f"{where} ({kind}) needs the token {token}, which this brand lacks")

    props = section.get("props", {})
    if not isinstance(props, dict):
        raise LayoutError(f"{where} props must be an object")

    allowed = definition["props"]
    for name in props:
        if name not in allowed:
            raise LayoutError(f"{where} has the unknown prop {name!r}")
    for name, rule in allowed.items():
        if name in props:
            _validate_prop(f"{where}.{name}", props[name], rule, resolved)
        elif rule.get("required"):
            raise LayoutError(f"{where} is missing the required prop {name!r}")

def _validate_prop(where: str, value: Any, rule: dict, resolved: ResolvedSet) -> None:
    kind = rule["type"]
    if kind == "string":
        if not isinstance(value, str):
            raise LayoutError(f"{where} must be a string")
    elif kind == "enum":
        if value not in rule["values"]:
            raise LayoutError(f"{where} must be one of {', '.join(rule['values'])}")
    else:
        if not isinstance(value, str) or not value.startswith(f"{rule['group']}."):
            raise LayoutError(f"{where} must be a {rule['group']} token")
        if f"semantic.{value}" not in resolved.tokens:
            raise LayoutError(f"{where} references the unknown token {value}")

def emit_layout(layout: dict) -> str:
    return json.dumps(layout, indent=2, ensure_ascii=False) + "\n"

def diff_layouts(before: dict, after: dict) -> list[dict]:
    records: list[dict] = []
    for screen in sorted(before.keys() - after.keys()):
        records.append(_record(f"layout.{screen}", REMOVED, MAJOR, "screen removed; links to it break"))
    for screen in sorted(after.keys() - before.keys()):
        records.append(_record(f"layout.{screen}", ADDED, MINOR, "screen added"))
    for screen in sorted(before.keys() & after.keys()):
        records.extend(_diff_screen(screen, before[screen], after[screen]))
    return records

def _diff_screen(screen: str, before: dict, after: dict) -> list[dict]:
    old = {section["id"]: section for section in before["sections"]}
    new = {section["id"]: section for section in after["sections"]}
    records: list[dict] = []

    for section_id in sorted(old.keys() - new.keys()):
        records.append(_record(
            f"layout.{screen}.{section_id}", REMOVED, MAJOR,
            "section removed; anything pointing at it breaks", before=old[section_id],
        ))
    for section_id in sorted(new.keys() - old.keys()):
        records.append(_record(
            f"layout.{screen}.{section_id}", ADDED, MINOR, "section added", after=new[section_id],
        ))

    shared = old.keys() & new.keys()
    for section_id in sorted(shared):
        was, now = old[section_id], new[section_id]
        path = f"layout.{screen}.{section_id}"
        if was["type"] != now["type"]:
            reason = f"section type changed from {was['type']} to {now['type']}"
            records.append(_record(path, CHANGED, MAJOR, reason, before=was, after=now))
        elif was.get("props", {}) != now.get("props", {}):
            records.append(_record(path, CHANGED, PATCH, "props changed", before=was, after=now))

    if [i for i in old if i in shared] != [i for i in new if i in shared]:
        records.append(_record(f"layout.{screen}", CHANGED, MINOR, "sections reordered"))
    return records

def _record(path: str, kind: str, severity: str, reason: str, *, before=None, after=None) -> dict:
    return {
        "path": path, "kind": kind, "severity": severity, "reason": reason,
        "cause": None, "upstream": [], "before": before, "after": after,
    }

def worst_severity(records: list[dict]) -> str:
    return max((r["severity"] for r in records), key=RANK.__getitem__, default="")
