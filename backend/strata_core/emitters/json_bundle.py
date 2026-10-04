
from __future__ import annotations

import json

from ..resolver import ResolvedSet
from .css import format_value, variable_name

def build_bundle(resolved: ResolvedSet, brand: str) -> dict:
    tokens = {}
    for path in sorted(resolved.tokens):
        token = resolved.tokens[path]
        entry = {"value": token.value, "type": token.type}
        if token.aliased_from:
            entry["aliasedFrom"] = token.aliased_from
        if token.description:
            entry["description"] = token.description
        tokens[path] = entry

    css_vars = {
        variable_name(token): format_value(token.value)
        for token in resolved.tokens.values()
    }

    return {
        "brand": brand,
        "tokenCount": len(resolved),
        "maxChainDepth": resolved.max_chain_depth,
        "tokens": tokens,
        "cssVariables": dict(sorted(css_vars.items())),
        "componentDefaults": _component_defaults(resolved),
    }

def _component_defaults(resolved: ResolvedSet) -> dict:

    defaults: dict = {}
    for path, token in resolved.layer("component").items():
        parts = path.split(".")[1:]
        cursor = defaults
        for part in parts[:-1]:
            cursor = cursor.setdefault(part, {})
        cursor[parts[-1]] = token.value
    return defaults

def emit_json(resolved: ResolvedSet, brand: str) -> str:
    return json.dumps(build_bundle(resolved, brand), indent=2, ensure_ascii=False) + "\n"
