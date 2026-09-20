from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from .graph import check_layering, dependencies, detect_cycles, topological_order
from .parse import REFERENCE, Token, parse

WHOLE_REFERENCE = re.compile(r"^\{([^{}]+)\}$")


@dataclass
class ResolvedToken:
    path: str
    type: str | None
    value: Any
    description: str = ""
    aliased_from: str | None = None

    @property
    def layer(self) -> str:
        return self.path.split(".", 1)[0]


@dataclass
class ResolvedSet:
    tokens: dict[str, ResolvedToken]
    order: list[str]
    max_chain_depth: int

    def layer(self, name: str) -> dict[str, ResolvedToken]:
        return {p: t for p, t in self.tokens.items() if t.layer == name}

    def __len__(self) -> int:
        return len(self.tokens)


def resolve_document(document: dict) -> ResolvedSet:
    return resolve(parse(document))


def resolve(tokens: dict[str, Token]) -> ResolvedSet:
    deps = dependencies(tokens)
    check_layering(tokens, deps)
    detect_cycles(deps)
    order = topological_order(deps)

    resolved: dict[str, ResolvedToken] = {}
    depth: dict[str, int] = {}

    for path in order:
        token = tokens[path]
        depth[path] = 1 + max((depth[ref] for ref in deps[path]), default=-1)

        whole = WHOLE_REFERENCE.match(token.value) if isinstance(token.value, str) else None
        if whole:
            target = resolved[whole.group(1)]
            value = target.value
            token_type = token.type or target.type
            aliased_from = whole.group(1)
        else:
            value = _substitute(token.value, resolved)
            token_type = token.type
            aliased_from = None

        resolved[path] = ResolvedToken(
            path=path,
            type=token_type,
            value=value,
            description=token.description,
            aliased_from=aliased_from,
        )

    return ResolvedSet(
        tokens=resolved,
        order=order,
        max_chain_depth=max(depth.values(), default=0),
    )


def _substitute(value: Any, resolved: dict[str, ResolvedToken]) -> Any:
    '''Replace references embedded inside a larger value.'''
    
    if isinstance(value, str):
        return REFERENCE.sub(lambda m: _as_text(resolved[m.group(1)].value), value)
    if isinstance(value, list):
        return [_substitute(item, resolved) for item in value]
    if isinstance(value, dict):
        return {k: _substitute(v, resolved) for k, v in value.items()}
    return value


def _as_text(value: Any) -> str:
    if isinstance(value, list):
        return ", ".join(_as_text(item) for item in value)
    return str(value)
