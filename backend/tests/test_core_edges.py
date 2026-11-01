import pytest

from strata_core import CycleError, TokenFileError, classify_diff, diff_documents, parse, resolve_document
from strata_core.emitters import build_bundle, emit_css, format_value, variable_name
from strata_core.graph import dependencies, topological_order


class TestMalformedDocuments:
    def test_a_document_must_be_an_object(self):
        with pytest.raises(TokenFileError, match="must be a JSON object"):
            parse(["not", "a", "document"])

    def test_a_document_without_tokens_is_rejected(self):
        with pytest.raises(TokenFileError, match="contains no tokens"):
            parse({"primitive": {"colour": {"$type": "color"}}})

    def test_a_bare_value_where_a_group_belongs_names_its_path(self):
        with pytest.raises(TokenFileError, match="primitive.colour.green must be a group"):
            parse({"primitive": {"colour": {"green": "#00ff00"}}})

    def test_references_are_found_inside_lists_and_objects(self):
        tokens = parse({"primitive": {"a": {"$value": 1}, "b": {"$value": 2},
                                      "c": {"$value": ["{primitive.a}", {"x": "{primitive.b}"}]}}})
        assert tokens["primitive.c"].refs == ["primitive.a", "primitive.b"]

    def test_non_string_values_have_no_references(self):
        assert parse({"primitive": {"n": {"$value": 4}}})["primitive.n"].refs == []


class TestGraphEdges:
    def test_a_repeated_reference_is_one_dependency(self):
        tokens = parse({"primitive": {"a": {"$value": "1px"},
                                      "b": {"$value": "{primitive.a} {primitive.a}"}}})
        assert dependencies(tokens)["primitive.b"] == ["primitive.a"]

    def test_tokens_outside_the_three_layers_are_not_layer_checked(self):
        resolved = resolve_document({"primitive": {"a": {"$value": "{custom.x}"}},
                                     "custom": {"x": {"$value": "1px"}}})
        assert resolved.tokens["primitive.a"].value == "1px"

    def test_topological_order_refuses_a_cycle_on_its_own(self):
        with pytest.raises(CycleError):
            topological_order({"a": ["b"], "b": ["a"], "c": []})

    def test_a_diamond_is_resolved_once(self):
        resolved = resolve_document({"primitive": {
            "base": {"$value": "4px"},
            "left": {"$value": "{primitive.base}"},
            "right": {"$value": "{primitive.base}"},
            "top": {"$value": "{primitive.left} {primitive.right}"},
        }})
        assert resolved.tokens["primitive.top"].value == "4px 4px"
        assert resolved.max_chain_depth == 2


class TestCompositeValues:
    def test_references_inside_an_object_value_are_substituted(self):
        resolved = resolve_document({"primitive": {
            "ink": {"$value": "#000"},
            "shadow": {"$value": {"color": "{primitive.ink}", "blur": "4px"}},
        }})
        assert resolved.tokens["primitive.shadow"].value == {"color": "#000", "blur": "4px"}

    def test_a_list_embedded_in_text_is_joined(self):
        resolved = resolve_document({"primitive": {
            "family": {"$value": ["Inter", "sans-serif"]},
            "font": {"$value": "16px {primitive.family}"},
        }})
        assert resolved.tokens["primitive.font"].value == "16px Inter, sans-serif"


class TestEmitters:
    def test_booleans_are_lowercase_css(self):
        assert (format_value(True), format_value(False)) == ("true", "false")

    def test_property_registration_can_be_turned_off(self):
        resolved = resolve_document({"semantic": {"c": {"$type": "color", "$value": "#fff"}}})
        assert "@property" in emit_css(resolved, "b")
        assert "@property" not in emit_css(resolved, "b", register_properties=False)

    def test_untyped_semantic_tokens_are_not_registered(self):
        resolved = resolve_document({"semantic": {"shadow": {"$value": "none"}}})
        assert "@property" not in emit_css(resolved, "b")

    def test_an_unknown_layer_gets_its_own_prefix_and_is_not_emitted(self):
        resolved = resolve_document({"custom": {"x": {"$value": "1px"}}})
        assert variable_name(resolved.tokens["custom.x"]) == "--custom-x"
        css = emit_css(resolved, "b")
        assert "--custom-x" not in css and css.rstrip().endswith("{\n}")

    def test_descriptions_reach_the_bundle(self):
        resolved = resolve_document({"primitive": {"a": {"$value": 1, "$description": "why"}}})
        assert build_bundle(resolved, "b")["tokens"]["primitive.a"]["description"] == "why"


class TestDiffEdges:
    def test_a_diff_knows_its_length_and_truthiness(self):
        v1 = {"primitive": {"a": {"$value": 1}}}
        v2 = {"primitive": {"a": {"$value": 2}, "b": {"$value": 3}}}
        diff = diff_documents(v1, v2)
        assert (len(diff), bool(diff), bool(diff_documents(v1, v1))) == (2, True, False)

    def test_a_cascade_through_a_shared_parent_names_one_source(self):
        v1 = {"primitive": {"base": {"$value": "1px"},
                            "mid": {"$value": "{primitive.base}"}},
              "semantic": {"x": {"$value": "{primitive.mid}"},
                           "y": {"$value": "{primitive.mid} {primitive.base}"}}}
        v2 = {**v1, "primitive": {**v1["primitive"], "base": {"$value": "2px"}}}
        report = classify_diff(diff_documents(v1, v2))
        assert set(report.by_source) == {"primitive.base"}
        assert {i.path for i in report.by_source["primitive.base"]} == {
            "primitive.mid", "semantic.x", "semantic.y"}

    def test_a_report_counts_by_severity(self):
        v1 = {"semantic": {"a": {"$value": 1}, "b": {"$value": 1}}}
        v2 = {"semantic": {"a": {"$value": 2}, "c": {"$value": 1}}}
        report = classify_diff(diff_documents(v1, v2))
        assert report.counts() == {"major": 1, "minor": 1, "patch": 1}
        assert sorted(r["kind"] for r in report.as_records()) == ["added", "changed", "removed"]
