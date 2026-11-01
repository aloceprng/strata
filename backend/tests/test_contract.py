import json
from pathlib import Path

import pytest

from strata_core import resolve_document

TOKENS_DIR = Path(__file__).resolve().parents[2] / "tokens"
BRAND_FILES = sorted(TOKENS_DIR.glob("*.tokens.json"))

COMPONENT_DEFAULTS = {
    "component.button.variant": {"primary", "secondary"},
    "component.button.size": {"sm", "md", "lg"},
    "component.card.elevation": {"flat", "raised"},
}


def load(path):
    return resolve_document(json.loads(path.read_text(encoding="utf-8")))


@pytest.fixture(scope="module")
def brands():
    return {path.name.removesuffix(".tokens.json"): load(path) for path in BRAND_FILES}


def test_there_are_three_brands(brands):
    assert sorted(brands) == ["clementine", "kumquat", "pomelo"]


@pytest.mark.parametrize("source", BRAND_FILES, ids=lambda p: p.name)
def test_every_component_default_is_set_to_an_allowed_value(source):
    defaults = load(source).layer("component")
    assert set(defaults) >= set(COMPONENT_DEFAULTS)
    for path, allowed in COMPONENT_DEFAULTS.items():
        assert defaults[path].value in allowed, f"{path} = {defaults[path].value!r}"


def test_a_token_shared_by_brands_has_one_type(brands):
    typed = [{p: t.type for p, t in b.tokens.items()} for b in brands.values()]
    shared = set(typed[0]).intersection(*typed[1:])
    assert all(len({types[path] for types in typed}) == 1 for path in shared)


@pytest.mark.parametrize("source", BRAND_FILES, ids=lambda p: p.name)
def test_primitive_groups_never_reuse_a_semantic_word(source):
    reserved = {"primary", "secondary", "action", "surface", "text", "border",
                "focus", "status", "danger", "warning", "success"}
    for path in load(source).layer("primitive"):
        groups = path.split(".")[1:-1]
        assert not reserved & set(groups), path
