import json
from pathlib import Path

import pytest

from strata_core import (
    CycleError,
    LayerViolationError,
    UnknownReferenceError,
    parse,
    resolve_document,
)
from strata_core.emitters import emit_css, emit_json

TOKENS_DIR = Path(__file__).resolve().parents[2] / "tokens"


@pytest.fixture
def croftwell():
    source = TOKENS_DIR / "croftwell.tokens.json"
    return resolve_document(json.loads(source.read_text(encoding="utf-8")))


class TestReferences:
    def test_resolves_a_single_alias(self):
        resolved = resolve_document({
            "primitive": {"colour": {"green": {"600": {"$type": "color", "$value": "#2f7a3f"}}}},
            "semantic": {"colour": {"action": {"bg": {"$value": "{primitive.colour.green.600}"}}}},
        })
        assert resolved.tokens["semantic.colour.action.bg"].value == "#2f7a3f"

    def test_resolves_a_chain_of_aliases(self):
        '''space.4 -> space.base -> 16px. Chains are normal, not exotic.'''
        resolved = resolve_document({
            "primitive": {
                "space": {
                    "$type": "dimension",
                    "base": {"$value": "16px"},
                    "4": {"$value": "{primitive.space.base}"},
                }
            },
            "semantic": {"space": {"card": {"padding": {"$value": "{primitive.space.4}"}}}},
        })
        assert resolved.tokens["semantic.space.card.padding"].value == "16px"
        assert resolved.max_chain_depth == 2

    def test_alias_inherits_the_target_type(self):
        resolved = resolve_document({
            "primitive": {"colour": {"g": {"$type": "color", "$value": "#000"}}},
            "semantic": {"colour": {"text": {"$value": "{primitive.colour.g}"}}},
        })
        assert resolved.tokens["semantic.colour.text"].type == "color"

    def test_an_alias_keeps_a_list_a_list(self):
        '''A fontFamily must not be flattened into a string by resolution.'''
        resolved = resolve_document({
            "primitive": {"font": {"family": {"sans": {
                "$type": "fontFamily", "$value": ["Inter", "Arial"]}}}},
            "semantic": {"font": {"body": {"family": {
                "$value": "{primitive.font.family.sans}"}}}},
        })
        assert resolved.tokens["semantic.font.body.family"].value == ["Inter", "Arial"]

    def test_reference_embedded_in_a_larger_string(self):
        resolved = resolve_document({
            "primitive": {"space": {"$type": "dimension", "2": {"$value": "8px"}}},
            "semantic": {"shadow": {"offset": {
                "$type": "string", "$value": "0 {primitive.space.2} 0 rgba(0,0,0,.1)"}}},
        })
        assert resolved.tokens["semantic.shadow.offset"].value == "0 8px 0 rgba(0,0,0,.1)"

    def test_a_missing_reference_names_both_ends(self):
        with pytest.raises(UnknownReferenceError) as exc:
            resolve_document({
                "semantic": {"colour": {"bg": {"$value": "{primitive.colour.nope}"}}},
            })
        assert exc.value.source == "semantic.colour.bg"
        assert exc.value.target == "primitive.colour.nope"


class TestCycles:
    def test_a_two_token_cycle_is_an_error_not_a_hang(self):
        with pytest.raises(CycleError) as exc:
            resolve_document({
                "semantic": {"space": {
                    "a": {"$value": "{semantic.space.b}"},
                    "b": {"$value": "{semantic.space.a}"},
                }},
            })
        assert exc.value.path[0] == exc.value.path[-1]
        assert set(exc.value.path) == {"semantic.space.a", "semantic.space.b"}

    def test_the_reported_path_is_the_whole_loop(self):
        ''''A cycle exists' is useless. 'a -> b -> c -> a' is debuggable.'''
        with pytest.raises(CycleError) as exc:
            resolve_document({
                "semantic": {"x": {
                    "a": {"$value": "{semantic.x.b}"},
                    "b": {"$value": "{semantic.x.c}"},
                    "c": {"$value": "{semantic.x.a}"},
                }},
            })
        assert len(exc.value.path) == 4
        assert "->" in str(exc.value)

    def test_a_token_referencing_itself(self):
        with pytest.raises(CycleError):
            resolve_document({"semantic": {"a": {"$value": "{semantic.a}"}}})

    def test_a_long_chain_does_not_exhaust_the_stack(self):
        '''Depth should be limited by the tokens, not by Python's recursion.'''
        depth = 5000
        group = {"0": {"$type": "dimension", "$value": "1px"}}
        for i in range(1, depth):
            group[str(i)] = {"$value": "{primitive.chain." + str(i - 1) + "}"}
        resolved = resolve_document({"primitive": {"chain": group}})
        assert resolved.tokens["primitive.chain." + str(depth - 1)].value == "1px"


class TestLayering:
    def test_a_primitive_may_not_reference_a_semantic_token(self):
        with pytest.raises(LayerViolationError):
            resolve_document({
                "primitive": {"colour": {"g": {"$value": "{semantic.colour.bg}"}}},
                "semantic": {"colour": {"bg": {"$type": "color", "$value": "#000"}}},
            })

    def test_a_semantic_token_may_reference_another_semantic_token(self):
        resolved = resolve_document({
            "primitive": {"colour": {"g": {"$type": "color", "$value": "#2f7a3f"}}},
            "semantic": {"colour": {
                "action": {"bg": {"$value": "{primitive.colour.g}"}},
                "focus": {"ring": {"$value": "{semantic.colour.action.bg}"}},
            }},
        })
        assert resolved.tokens["semantic.colour.focus.ring"].value == "#2f7a3f"


class TestParsing:
    def test_group_type_is_inherited_by_its_tokens(self):
        tokens = parse({"primitive": {"space": {
            "$type": "dimension", "1": {"$value": "4px"}}}})
        assert tokens["primitive.space.1"].type == "dimension"

    def test_a_token_overrides_its_group_type(self):
        tokens = parse({"primitive": {"x": {
            "$type": "dimension", "a": {"$type": "color", "$value": "#000"}}}})
        assert tokens["primitive.x.a"].type == "color"


class TestEmitters:
    def test_semantic_tokens_drop_the_layer_prefix(self, croftwell):
        assert "--colour-action-bg: #2f7a3f;" in emit_css(croftwell, "croftwell")

    def test_primitives_are_namespaced_so_misuse_is_visible(self, croftwell):
        assert "--p-colour-green-600:" in emit_css(croftwell, "croftwell")

    def test_no_references_survive_resolution(self, croftwell):
        for token in croftwell.tokens.values():
            assert "{" not in str(token.value), token.path

    def test_font_family_lists_are_quoted_where_needed(self, croftwell):
        assert '"Helvetica Neue"' in emit_css(croftwell, "croftwell")

    def test_the_brand_can_be_scoped_to_one_column(self, croftwell):
        assert '[data-brand="croftwell"]' in emit_css(croftwell, "croftwell")

    def test_component_defaults_are_nested_for_consumers(self, croftwell):
        bundle = json.loads(emit_json(croftwell, "croftwell"))
        assert bundle["componentDefaults"]["button"]["variant"] == "secondary"

    def test_the_bundle_is_byte_stable_across_builds(self, croftwell):
        '''No timestamp inside an artifact, or its checksum means nothing.'''
        assert emit_json(croftwell, "croftwell") == emit_json(croftwell, "croftwell")


BRAND_FILES = sorted(TOKENS_DIR.glob("*.tokens.json"))


class TestRealBrandFiles:
    @pytest.mark.parametrize("source", BRAND_FILES, ids=lambda p: p.name)
    def test_every_brand_file_resolves(self, source):
        resolve_document(json.loads(source.read_text(encoding="utf-8")))

    @pytest.mark.parametrize("source", BRAND_FILES, ids=lambda p: p.name)
    def test_every_brand_defines_the_same_semantic_tokens(self, source, croftwell):
        '''A component reads one name on every brand, or the demo is a lie.'''
        other = resolve_document(json.loads(source.read_text(encoding="utf-8")))
        assert set(croftwell.layer("semantic")) == set(other.layer("semantic"))
