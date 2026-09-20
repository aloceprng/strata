from __future__ import annotations

from typing import Any

from ..resolver import ResolvedSet, ResolvedToken

PROPERTY_SYNTAX = {
    "color": "<color>",
    "dimension": "<length>",
    "number": "<number>",
}

LAYER_PREFIX = {"primitive": "p-", "semantic": "", "component": "component-"}


def variable_name(token: ResolvedToken) -> str:
    layer, _, rest = token.path.partition(".")
    prefix = LAYER_PREFIX.get(layer, f"{layer}-")
    return "--" + prefix + rest.replace(".", "-")


def format_value(value: Any) -> str:
    if isinstance(value, list):
        return ", ".join(_quote(str(item)) for item in value)
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def _quote(name: str) -> str:
    return f'"{name}"' if " " in name else name


def emit_css(resolved: ResolvedSet, brand: str, *, register_properties: bool = True) -> str:
    '''Return the full text of a brand's ``theme.css``.'''
    lines = [
        f"/* Strata — {brand}",
        f" * Generated from the token source. Do not edit; edit the tokens.",
        f" * {len(resolved)} tokens, longest alias chain {resolved.max_chain_depth}.",
        " */",
        "",
    ]

    if register_properties:
        lines.extend(_property_registrations(resolved))

    lines.extend([
        ":root,",
        f':root[data-brand="{brand}"],',
        f'[data-brand="{brand}"] {{',
    ])

    for layer in ("primitive", "semantic", "component"):
        group = resolved.layer(layer)
        if not group:
            continue
        lines.append(f"  /* {layer} */")
        for path in sorted(group):
            token = group[path]
            lines.append(f"  {variable_name(token)}: {format_value(token.value)};")
        lines.append("")

    if lines[-1] == "":
        lines.pop()
    lines.append("}")
    lines.append("")
    return "\n".join(lines)


def _property_registrations(resolved: ResolvedSet) -> list[str]:
    '''``@property`` blocks for the semantic tokens that can interpolate.'''

    lines = [
        "/* Registered so a brand switch interpolates rather than snapping. */",
    ]
    for path in sorted(resolved.layer("semantic")):
        token = resolved.tokens[path]
        syntax = PROPERTY_SYNTAX.get(token.type or "")
        if not syntax:
            continue
        lines.extend([
            f"@property {variable_name(token)} {{",
            f"  syntax: '{syntax}';",
            "  inherits: true;",
            f"  initial-value: {format_value(token.value)};",
            "}",
        ])
    lines.append("")
    return lines
