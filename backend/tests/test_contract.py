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
    assert set(defaults) == set(COMPONENT_DEFAULTS)
    for path, allowed in COMPONENT_DEFAULTS.items():
        assert defaults[path].value in allowed, f"{path} = {defaults[path].value!r}"


def test_every_brand_has_the_same_primitive_names(brands):
    shapes = {name: set(brand.layer("primitive")) for name, brand in brands.items()}
    first = next(iter(shapes.values()))
    assert all(shape == first for shape in shapes.values())
    assert len(first) == 104


def test_every_brand_has_the_same_types_per_token(brands):
    typed = {name: {p: t.type for p, t in b.tokens.items()} for name, b in brands.items()}
    first = next(iter(typed.values()))
    assert all(types == first for types in typed.values())


@pytest.mark.parametrize("source", BRAND_FILES, ids=lambda p: p.name)
def test_primitive_groups_never_reuse_a_semantic_word(source):
    reserved = {"primary", "secondary", "action", "surface", "text", "border",
                "focus", "status", "danger", "warning", "success"}
    for path in load(source).layer("primitive"):
        groups = path.split(".")[1:-1]
        assert not reserved & set(groups), path
