import copy
import json
from pathlib import Path

import pytest

from strata_core import diff_documents

TOKENS_DIR = Path(__file__).resolve().parents[2] / "tokens"

@pytest.fixture
def v1():
    return {
        "primitive": {
            "colour": {"$type": "color",
                       "green": {"600": {"$value": "#2f7a3f"}, "700": {"$value": "#245f31"}}},
            "radius": {"$type": "dimension", "control": {"$value": "4px"}},
        },
        "semantic": {
            "colour": {"$type": "color", "action": {
                "bg": {"$value": "{primitive.colour.green.600}"},
                "border": {"$value": "{semantic.colour.action.bg}"},
            }},
            "radius": {"control": {"$type": "dimension", "$value": "{primitive.radius.control}"}},
        },
    }

def edited(document, path, **fields):
    document = copy.deepcopy(document)
    *groups, name = path.split(".")
    node = document
    for group in groups:
        node = node[group]
    node[name].update({f"${key}": value for key, value in fields.items()})
    return document

class TestNothingChanged:
    def test_identical_documents_have_an_empty_diff(self, v1):
        assert not diff_documents(v1, copy.deepcopy(v1))

    def test_a_description_edit_is_not_a_change(self, v1):
        v2 = edited(v1, "primitive.colour.green.600", description="the brand green")
        assert not diff_documents(v1, v2)

    @pytest.mark.parametrize("source", sorted(TOKENS_DIR.glob("*.tokens.json")),
                             ids=lambda p: p.stem)
    def test_every_real_brand_file_diffs_clean_against_itself(self, source):
        document = json.loads(source.read_text(encoding="utf-8"))
        assert not diff_documents(document, copy.deepcopy(document))

class TestAddedAndRemoved:
    def test_a_new_token_is_added(self, v1):
        v2 = copy.deepcopy(v1)
        v2["semantic"]["colour"]["warning"] = {"bg": {"$value": "#f5c542"}}
        result = diff_documents(v1, v2)
        assert [c.path for c in result.added] == ["semantic.colour.warning.bg"]
        assert result.added[0].after.value == "#f5c542"

    def test_a_deleted_token_is_removed(self, v1):
        v2 = copy.deepcopy(v1)
        del v2["semantic"]["colour"]["action"]["border"]
        result = diff_documents(v1, v2)
        assert [c.path for c in result.removed] == ["semantic.colour.action.border"]

    def test_a_rename_is_a_removal_plus_an_addition(self, v1):
        v2 = copy.deepcopy(v1)
        v2["semantic"]["colour"]["action"]["outline"] = (
            v2["semantic"]["colour"]["action"].pop("border"))
        result = diff_documents(v1, v2)
        assert [c.path for c in result.removed] == ["semantic.colour.action.border"]
        assert [c.path for c in result.added] == ["semantic.colour.action.outline"]
        assert not result.changed

class TestDirectAndCascade:
    def test_one_primitive_edit_reaches_everything_downstream(self, v1):
        v2 = edited(v1, "primitive.colour.green.600", value="#1f5a2c")
        result = diff_documents(v1, v2)
        assert [(c.path, c.cause) for c in result.changed] == [
            ("primitive.colour.green.600", "direct"),
            ("semantic.colour.action.bg", "cascade"),
            ("semantic.colour.action.border", "cascade"),
        ]

    def test_a_cascade_names_the_edit_it_came_from(self, v1):
        v2 = edited(v1, "primitive.colour.green.600", value="#1f5a2c")
        border = next(c for c in diff_documents(v1, v2).changed
                      if c.path == "semantic.colour.action.border")
        assert border.upstream == ("primitive.colour.green.600",)
        assert border.before.value == "#2f7a3f"
        assert border.after.value == "#1f5a2c"

    def test_repointing_an_alias_is_direct(self, v1):
        v2 = edited(v1, "semantic.colour.action.bg", value="{primitive.colour.green.700}")
        result = diff_documents(v1, v2)
        bg = next(c for c in result.changed if c.path == "semantic.colour.action.bg")
        assert bg.cause == "direct"
        assert bg.authored_before == "{primitive.colour.green.600}"
        assert bg.authored_after == "{primitive.colour.green.700}"
        border = next(c for c in result.changed if c.path == "semantic.colour.action.border")
        assert border.upstream == ("semantic.colour.action.bg",)

    def test_repointing_to_an_identical_value_changes_nothing_visible(self, v1):
        v2 = copy.deepcopy(v1)
        v2["primitive"]["colour"]["green"]["650"] = {"$value": "#2f7a3f"}
        v2 = edited(v2, "semantic.colour.action.bg", value="{primitive.colour.green.650}")
        bg = next(c for c in diff_documents(v1, v2).changed
                  if c.path == "semantic.colour.action.bg")
        assert bg.cause == "direct"
        assert not bg.value_changed

    def test_a_type_change_is_flagged(self, v1):
        v2 = edited(v1, "semantic.radius.control", type="string", value="round")
        change = next(c for c in diff_documents(v1, v2).changed
                      if c.path == "semantic.radius.control")
        assert change.type_changed
        assert (change.before.type, change.after.type) == ("dimension", "string")

    def test_a_cascade_with_two_sources_names_both(self):
        v1 = {"primitive": {
            "a": {"$value": "1px"}, "b": {"$value": "2px"},
            "pair": {"$value": "{primitive.a} {primitive.b}"},
        }}
        v2 = copy.deepcopy(v1)
        v2["primitive"]["a"]["$value"] = "3px"
        v2["primitive"]["b"]["$value"] = "4px"
        pair = next(c for c in diff_documents(v1, v2).changed if c.path == "primitive.pair")
        assert pair.cause == "cascade"
        assert pair.upstream == ("primitive.a", "primitive.b")

    def test_a_long_chain_does_not_exhaust_the_stack(self):
        chain = {"t0": {"$value": "1px"}}
        for i in range(1, 3000):
            chain[f"t{i}"] = {"$value": f"{{primitive.t{i - 1}}}"}
        v1 = {"primitive": chain}
        v2 = copy.deepcopy(v1)
        v2["primitive"]["t0"]["$value"] = "2px"
        result = diff_documents(v1, v2)
        assert len(result.changed) == 3000
        last = next(c for c in result.changed if c.path == "primitive.t2999")
        assert last.upstream == ("primitive.t0",)

def test_changes_come_back_sorted_by_path(v1):
    v2 = edited(v1, "primitive.colour.green.600", value="#1f5a2c")
    v2["semantic"]["colour"]["warning"] = {"bg": {"$value": "#f5c542"}}
    del v2["semantic"]["radius"]
    paths = [c.path for c in diff_documents(v1, v2).changes]
    assert paths == sorted(paths)
