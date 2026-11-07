"""A brand's sample catalogue: the products its screens show and its basket sells.

The catalogue is published with tokens and layouts, so a product page, a card and a
basket line all read one record. Layouts refer to products by id, and publish
refuses an id the catalogue does not hold.
"""
from __future__ import annotations

import json
import re
from typing import Any

from .classify import MAJOR, MINOR, PATCH
from .diff import ADDED, CHANGED, REMOVED
from .errors import CatalogueError

SCHEMA_VERSION = 1
ID = re.compile(r"[a-z0-9]+(-[a-z0-9]+)*")
HEX = re.compile(r"#[0-9a-fA-F]{6}")
ASSET = re.compile(r"/(?:[a-z0-9]+(?:-[a-z0-9]+)*/)*[a-z0-9]+(?:-[a-z0-9]+)*\.(?:png|jpg|webp|svg)")
TONES = ["deal", "alert", "info", "inverse"]

LABEL = {"label": {"type": "string", "required": True}, "tone": {"type": "enum", "values": TONES}}

PRODUCT = {
    "name": {"type": "string", "required": True},
    "price": {"type": "money", "required": True},
    "image": {"type": "asset", "required": True},
    "category": {"type": "category"},
    "unit": {"type": "string"},
    "per": {"type": "string"},
    "unitPrice": {"type": "string"},
    "summary": {"type": "string"},
    "description": {"type": "string"},
    "material": {"type": "string"},
    "delivery": {"type": "string"},
    "tag": {"type": "object", "fields": LABEL},
    "badges": {"type": "list", "max": 4, "items": LABEL},
    "offer": {"type": "offer"},
    "filters": {"type": "list", "max": 8, "of": "string"},
    "details": {"type": "list", "max": 8, "items": {
        "title": {"type": "string", "required": True},
        "body": {"type": "string", "required": True},
    }},
    "specs": {"type": "list", "max": 12, "items": {
        "label": {"type": "string", "required": True},
        "value": {"type": "string", "required": True},
    }},
    "options": {"type": "object", "fields": {
        "label": {"type": "string", "required": True},
        "choices": {"type": "list", "min": 1, "max": 12, "required": True, "items": {
            "name": {"type": "string", "required": True},
            "swatch": {"type": "hex", "required": True},
        }},
    }},
    "related": {"type": "list", "max": 12, "of": "product"},
}

CATALOGUE = {
    "schemaVersion": {"type": "integer", "required": True},
    "currency": {"type": "object", "required": True, "fields": {
        "code": {"type": "string", "required": True},
        "decimals": {"type": "integer", "required": True, "min": 0, "max": 2},
    }},
    "delivery": {"type": "object", "fields": {"fee": {"type": "money", "required": True, "min": 0}}},
    "categories": {"type": "map", "of": {"name": {"type": "string", "required": True}}},
    "products": {"type": "map", "required": True, "of": PRODUCT},
    "extras": {"type": "list", "max": 6, "items": {
        "id": {"type": "id", "required": True},
        "label": {"type": "string", "required": True},
        "note": {"type": "string"},
        "price": {"type": "money", "required": True, "min": 0},
        "selected": {"type": "boolean"},
    }},
    "basket": {"type": "list", "max": 20, "items": {
        "product": {"type": "product", "required": True},
        "quantity": {"type": "integer", "required": True, "min": 1, "max": 99},
        "option": {"type": "string"},
    }},
    "saved": {"type": "list", "max": 50, "of": "product"},
}


def validate_catalogue(catalogue: Any) -> None:
    if catalogue in (None, {}):
        return
    if not isinstance(catalogue, dict):
        raise CatalogueError("the catalogue must be an object")
    if catalogue.get("schemaVersion") != SCHEMA_VERSION:
        raise CatalogueError(
            f"the catalogue has schema version {catalogue.get('schemaVersion')!r}, "
            f"expected {SCHEMA_VERSION}"
        )
    _Checker(catalogue).fields("catalogue", catalogue, CATALOGUE)


def product_ids(catalogue: dict | None) -> set[str]:
    return set((catalogue or {}).get("products", {}))


class _Checker:
    def __init__(self, catalogue: dict):
        self.products = product_ids(catalogue)
        self.categories = set(catalogue.get("categories", {}))

    def fields(self, where: str, values: Any, allowed: dict) -> None:
        if not isinstance(values, dict):
            raise CatalogueError(f"{where} must be an object")
        for name in values:
            if name not in allowed:
                raise CatalogueError(f"{where} has the unknown field {name!r}")
        for name, rule in allowed.items():
            if name in values:
                self.value(f"{where}.{name}", values[name], rule)
            elif rule.get("required"):
                raise CatalogueError(f"{where} is missing {name!r}")

    def value(self, where: str, value: Any, rule: dict) -> None:
        kind = rule["type"]
        if kind == "string":
            if not isinstance(value, str) or not value.strip():
                raise CatalogueError(f"{where} must be text")
        elif kind == "boolean":
            if not isinstance(value, bool):
                raise CatalogueError(f"{where} must be true or false")
        elif kind in ("integer", "money"):
            self.number(where, value, rule, integer=kind == "integer")
        elif kind == "enum":
            if value not in rule["values"]:
                raise CatalogueError(f"{where} must be one of {', '.join(rule['values'])}")
        elif kind == "id":
            if not isinstance(value, str) or not ID.fullmatch(value):
                raise CatalogueError(f"{where} must be a lowercase id such as navel-orange")
        elif kind == "asset":
            if not isinstance(value, str) or not ASSET.fullmatch(value):
                raise CatalogueError(f"{where} must be an image path such as /products/brand/name.png")
        elif kind == "hex":
            if not isinstance(value, str) or not HEX.fullmatch(value):
                raise CatalogueError(f"{where} must be a colour such as #14602a")
        elif kind == "product":
            if value not in self.products:
                raise CatalogueError(f"{where} refers to {value!r}, which is not in the catalogue")
        elif kind == "category":
            if value not in self.categories:
                raise CatalogueError(f"{where} refers to the unknown category {value!r}")
        elif kind == "object":
            self.fields(where, value, rule["fields"])
        elif kind == "map":
            if not isinstance(value, dict):
                raise CatalogueError(f"{where} must be an object keyed by id")
            for key, item in value.items():
                self.value(f"{where}.{key}", key, {"type": "id"})
                self.fields(f"{where}.{key}", item, rule["of"])
        elif kind == "list":
            self.list(where, value, rule)
        elif kind == "offer":
            self.offer(where, value)
        else:  # pragma: no cover - a schema typo, not user input
            raise AssertionError(f"unknown rule type {kind}")

    def number(self, where: str, value: Any, rule: dict, *, integer: bool) -> None:
        if isinstance(value, bool) or not isinstance(value, int if integer else (int, float)):
            raise CatalogueError(f"{where} must be {'a whole number' if integer else 'a number'}")
        low = rule.get("min", 0 if integer else 0.01)
        high = rule.get("max", value)
        if not low <= value <= high:
            raise CatalogueError(f"{where} must be at least {low}" + (f" and at most {high}" if "max" in rule else ""))

    def list(self, where: str, value: Any, rule: dict) -> None:
        if not isinstance(value, list):
            raise CatalogueError(f"{where} must be a list")
        low, high = rule.get("min", 0), rule.get("max", len(value))
        if not low <= len(value) <= high:
            raise CatalogueError(f"{where} must have between {low} and {high} items")
        for position, item in enumerate(value):
            if "items" in rule:
                self.fields(f"{where}[{position}]", item, rule["items"])
            else:
                self.value(f"{where}[{position}]", item, {"type": rule["of"]})

    def offer(self, where: str, value: Any) -> None:
        if not isinstance(value, dict):
            raise CatalogueError(f"{where} must be an object")
        kind = value.get("type")
        if kind == "multibuy":
            self.fields(where, value, {
                "type": {"type": "string", "required": True},
                "quantity": {"type": "integer", "required": True, "min": 2, "max": 12},
                "price": {"type": "money", "required": True},
            })
        elif kind == "free":
            self.fields(where, value, {
                "type": {"type": "string", "required": True},
                "buy": {"type": "integer", "required": True, "min": 1, "max": 12},
                "free": {"type": "integer", "required": True, "min": 1, "max": 12},
            })
        else:
            raise CatalogueError(f"{where}.type must be multibuy or free")


def emit_catalogue(catalogue: dict) -> str:
    return json.dumps(catalogue, indent=2, ensure_ascii=False) + "\n"


def diff_catalogues(before: dict | None, after: dict | None) -> list[dict]:
    before, after = before or {}, after or {}
    old, new = before.get("products", {}), after.get("products", {})
    records: list[dict] = []
    for product in sorted(old.keys() - new.keys()):
        records.append(_record(
            f"catalogue.{product}", REMOVED, MAJOR,
            "product removed; its page, links and saved baskets break", before=old[product],
        ))
    for product in sorted(new.keys() - old.keys()):
        records.append(_record(f"catalogue.{product}", ADDED, MINOR, "product added", after=new[product]))
    for product in sorted(old.keys() & new.keys()):
        if old[product] != new[product]:
            records.append(_record(
                f"catalogue.{product}", CHANGED, PATCH, "product details changed",
                before=old[product], after=new[product],
            ))
    if _settings(before) != _settings(after):
        records.append(_record(
            "catalogue", CHANGED, PATCH, "currency, delivery, extras or sample basket changed",
            before=_settings(before), after=_settings(after),
        ))
    return records


def _settings(catalogue: dict) -> dict:
    return {key: value for key, value in catalogue.items() if key != "products"}


def _record(path: str, kind: str, severity: str, reason: str, *, before=None, after=None) -> dict:
    return {
        "path": path, "kind": kind, "severity": severity, "reason": reason,
        "cause": None, "upstream": [], "before": before, "after": after,
    }
