from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from .classify import MAJOR, MINOR, PATCH, RANK
from .diff import ADDED, CHANGED, REMOVED
from .catalogue import product_ids
from .errors import LayoutError
from .resolver import ResolvedSet

SCREEN_NAME = re.compile(r"[a-z0-9]+(-[a-z0-9]+)*")
SCREEN_FITS = ("scroll", "viewport")
ASSET_PATH = re.compile(r"/(?:[a-z0-9]+(?:-[a-z0-9]+)*/)*[a-z0-9]+(?:-[a-z0-9]+)*\.(?:png|jpg|webp|svg)")

def load_contract(path: Path | str) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))

# The product screen is a template: the frontend renders it once per catalogue product.
PRODUCT_SCREEN = "product"
PRODUCT_LINK = re.compile(r"product/([a-z0-9]+(?:-[a-z0-9]+)*)")


class _Context:
    """What a prop may point at: this version's tokens, screens and products."""

    def __init__(self, resolved: ResolvedSet, layouts: dict, catalogue: dict | None):
        self.resolved = resolved
        self.screens = set(layouts) - {PRODUCT_SCREEN}
        self.products = product_ids(catalogue)


def validate_layouts(
    layouts: dict, contract: dict, resolved: ResolvedSet, catalogue: dict | None = None,
) -> None:
    if not isinstance(layouts, dict):
        raise LayoutError("layouts must be an object of screens")
    context = _Context(resolved, layouts, catalogue)
    for screen, layout in layouts.items():
        _validate_screen(screen, layout, contract, context)

def _validate_screen(screen: str, layout: Any, contract: dict, context: _Context) -> None:
    if not SCREEN_NAME.fullmatch(screen):
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
    if layout.get("fit", "scroll") not in SCREEN_FITS:
        raise LayoutError(f"{screen} fit must be one of {', '.join(SCREEN_FITS)}")
    if "gap" in layout:
        _validate_prop(f"{screen}.gap", layout["gap"], {"type": "token", "group": "space"}, context)
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
        _validate_section(screen, f"{screen}.{section_id}", section, contract, context)

def _validate_section(
    screen: str, where: str, section: dict, contract: dict, context: _Context,
) -> None:
    kind = section.get("type")
    definition = contract["sections"].get(kind) if isinstance(kind, str) else None
    if definition is None:
        raise LayoutError(f"{where} has the unknown section type {kind!r}")
    if definition.get("context") == PRODUCT_SCREEN and screen != PRODUCT_SCREEN:
        raise LayoutError(
            f"{where} ({kind}) shows the current product, so it belongs on the product screen"
        )

    for token in definition.get("tokens", []):
        if f"semantic.{token}" not in context.resolved.tokens:
            raise LayoutError(f"{where} ({kind}) needs the token {token}, which this brand lacks")

    props = section.get("props", {})
    if not isinstance(props, dict):
        raise LayoutError(f"{where} props must be an object")

    _validate_fields(where, props, definition["props"], context)

def _validate_fields(where: str, values: dict, allowed: dict, context: _Context) -> None:
    for name in values:
        if name not in allowed:
            raise LayoutError(f"{where} has the unknown prop {name!r}")
    for name, rule in allowed.items():
        if name in values:
            _validate_prop(f"{where}.{name}", values[name], rule, context)
        elif rule.get("required"):
            raise LayoutError(f"{where} is missing the required prop {name!r}")

def _validate_prop(where: str, value: Any, rule: dict, context: _Context) -> None:
    kind = rule["type"]
    if kind == "string":
        if not isinstance(value, str):
            raise LayoutError(f"{where} must be a string")
    elif kind == "enum":
        if value not in rule["values"]:
            raise LayoutError(f"{where} must be one of {', '.join(rule['values'])}")
    elif kind == "boolean":
        if not isinstance(value, bool):
            raise LayoutError(f"{where} must be true or false")
    elif kind == "number":
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise LayoutError(f"{where} must be a number")
        if value < rule.get("min", value) or value > rule.get("max", value):
            raise LayoutError(f"{where} must be between {rule.get('min')} and {rule.get('max')}")
    elif kind == "asset":
        if not isinstance(value, str) or not ASSET_PATH.fullmatch(value):
            raise LayoutError(f"{where} must be an image path such as /products/brand/name.png")
    elif kind == "list":
        _validate_list(where, value, rule, context)
    elif kind == "product":
        _validate_product(where, value, context)
    elif kind == "products":
        if not isinstance(value, list):
            raise LayoutError(f"{where} must be a list of product ids")
        low, high = rule.get("min", 0), rule.get("max", len(value))
        if not low <= len(value) <= high:
            raise LayoutError(f"{where} must have between {low} and {high} products")
        for position, product in enumerate(value):
            _validate_product(f"{where}[{position}]", product, context)
    elif kind == "link":
        _validate_link(where, value, context)
    else:
        if not isinstance(value, str) or not value.startswith(f"{rule['group']}."):
            raise LayoutError(f"{where} must be a {rule['group']} token")
        if f"semantic.{value}" not in context.resolved.tokens:
            raise LayoutError(f"{where} references the unknown token {value}")

def _validate_product(where: str, value: Any, context: _Context) -> None:
    if not isinstance(value, str) or value not in context.products:
        raise LayoutError(f"{where} refers to the product {value!r}, which is not in the catalogue")

def _validate_link(where: str, value: Any, context: _Context) -> None:
    """A link names a screen of this version, or product/<id>. Nothing else is allowed."""
    if not isinstance(value, str):
        raise LayoutError(f"{where} must be a screen name or product/<id>")
    product = PRODUCT_LINK.fullmatch(value)
    if product:
        _validate_product(where, product.group(1), context)
    elif value not in context.screens:
        raise LayoutError(f"{where} links to {value!r}, which is not a screen of this version")

def _validate_list(where: str, value: Any, rule: dict, context: _Context) -> None:
    if not isinstance(value, list):
        raise LayoutError(f"{where} must be a list")
    low, high = rule.get("min", 0), rule.get("max", len(value))
    if not low <= len(value) <= high:
        raise LayoutError(f"{where} must have between {low} and {high} items")
    for position, item in enumerate(value):
        if not isinstance(item, dict):
            raise LayoutError(f"{where}[{position}] must be an object")
        _validate_fields(f"{where}[{position}]", item, rule["items"], context)

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
    if before.get("fit", "scroll") != after.get("fit", "scroll"):
        records.append(_record(f"layout.{screen}.fit", CHANGED, MINOR, "screen fit changed",
                               before=before.get("fit", "scroll"), after=after.get("fit", "scroll")))
    if before.get("gap") != after.get("gap"):
        records.append(_record(f"layout.{screen}.gap", CHANGED, PATCH, "screen spacing changed",
                               before=before.get("gap"), after=after.get("gap")))
    return records

def _record(path: str, kind: str, severity: str, reason: str, *, before=None, after=None) -> dict:
    return {
        "path": path, "kind": kind, "severity": severity, "reason": reason,
        "cause": None, "upstream": [], "before": before, "after": after,
    }

def worst_severity(records: list[dict]) -> str:
    return max((r["severity"] for r in records), key=RANK.__getitem__, default="")
