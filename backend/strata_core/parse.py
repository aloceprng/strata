# turn a DTCG token document into a flat list of tokens.

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from .errors import TokenFileError

REFERENCE = re.compile(r"\{([^{}]+)\}")
LAYERS = ("primitive", "semantic", "component")


@dataclass
class Token:
    '''Token before resolution.'''

    path: str
    type: str | None
    value: Any
    description: str = ""
    refs: list[str] = field(default_factory=list)

    @property
    def layer(self) -> str:
        return self.path.split(".", 1)[0]


def find_references(value: Any) -> list[str]:
    '''Every {token.path} inside a value, in the order it appears.'''

    if isinstance(value, str):
        return REFERENCE.findall(value)
    if isinstance(value, list):
        return [ref for item in value for ref in find_references(item)]
    if isinstance(value, dict):
        return [ref for item in value.values() for ref in find_references(item)]
    return []


def parse(document: dict) -> dict[str, Token]:
    '''Flatten a DTCG document to ``{"semantic.colour.action.bg": Token, ...}``.'''

    if not isinstance(document, dict):
        raise TokenFileError("token document must be a JSON object")

    tokens: dict[str, Token] = {}
    _walk(document, prefix=(), inherited_type=None, out=tokens)
    if not tokens:
        raise TokenFileError("token document contains no tokens ($value keys)")
    return tokens


def _walk(node: dict, prefix: tuple[str, ...], inherited_type: str | None,
          out: dict[str, Token]) -> None:
    node_type = node.get("$type", inherited_type)

    for key, child in node.items():
        if key.startswith("$"):
            continue
        if not isinstance(child, dict):
            raise TokenFileError(
                f"{'.'.join(prefix + (key,))} must be a group or a token object"
            )

        path = prefix + (key,)
        if "$value" in child:
            dotted = ".".join(path)
            out[dotted] = Token(
                path=dotted,
                type=child.get("$type", node_type),
                value=child["$value"],
                description=child.get("$description", ""),
                refs=find_references(child["$value"]),
            )
        else:
            _walk(child, path, child.get("$type", node_type), out)
