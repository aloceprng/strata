import copy
import json
from pathlib import Path

import pytest
from django.core.exceptions import ValidationError

from strata_core import (
    LayoutError,
    diff_layouts,
    load_contract,
    resolve_document,
    validate_layouts,
    worst_severity,
)
from tokens.models import Brand, TokenSet

REPO = Path(__file__).resolve().parents[2]
CONTRACT = {
    "schemaVersion": 1,
    "sections": {
        "Intro": {
            "tokens": ["colour.text.primary"],
            "props": {
                "title": {"type": "string", "required": True},
                "tone": {"type": "enum", "values": ["secondary", "accent"]},
                "gap": {"type": "token", "group": "space.stack"},
            },
        },
        "Note": {"props": {"text": {"type": "string"}}},
    },
}
TOKENS = {"semantic": {
    "colour": {"text": {"primary": {"$type": "color", "$value": "#000"}}},
    "space": {"stack": {"gap": {"$type": "dimension", "$value": "8px"}}},
}}


def section(section_id="intro", kind="Intro", **props):
    return {"id": section_id, "type": kind, "props": {"title": "Hi", **props}}


def screen(*sections, name="home"):
    return {"schemaVersion": 1, "screen": name, "sections": list(sections)}


LAYOUTS = {"home": screen(section())}


def check(layouts, contract=CONTRACT, tokens=TOKENS):
    validate_layouts(layouts, contract, resolve_document(tokens))


class TestValidation:
    def test_a_valid_layout_passes(self):
        check({"home": screen(section(tone="accent", gap="space.stack.gap"))})

    def test_a_brand_may_have_no_screens(self):
        check({})

    def test_props_are_optional_unless_required(self):
        check({"home": screen({"id": "n", "type": "Note"})})

    @pytest.mark.parametrize("layouts, message", [
        ([], "object of screens"),
        ({"../escape": screen()}, "not a valid screen name"),
        ({"Home": screen()}, "not a valid screen name"),
        ({"home\n": screen(name="home\n")}, "not a valid screen name"),
        ({"home": "nope"}, "home must be an object"),
        ({"home": {"schemaVersion": 2, "screen": "home", "sections": []}}, "schema version 2"),
        ({"home": {"screen": "home", "sections": []}}, "schema version None"),
        ({"home": screen(name="other")}, "labelled 'other'"),
        ({"home": {"schemaVersion": 1, "screen": "home"}}, "list of sections"),
        ({"home": screen("nope")}, r"sections\[0\] must be an object"),
        ({"home": screen({"type": "Intro"})}, "needs an id"),
        ({"home": screen({"id": "", "type": "Intro"})}, "needs an id"),
        ({"home": screen({"id": 7, "type": "Intro"})}, "needs an id"),
        ({"home": screen(section("a"), section("a"))}, "id 'a' twice"),
        ({"home": screen(section(kind="Carousel"))}, "unknown section type 'Carousel'"),
        ({"home": screen(section(kind=["Intro"]))}, "unknown section type"),
        ({"home": screen(section(kind={"name": "Intro"}))}, "unknown section type"),
        ({"home": screen({"id": "a", "type": "Intro", "props": []})}, "props must be an object"),
        ({"home": screen({"id": "a", "type": "Intro", "props": {}})}, "required prop 'title'"),
        ({"home": screen(section(extra="x"))}, "unknown prop 'extra'"),
        ({"home": screen(section(title=4))}, "title must be a string"),
        ({"home": screen(section(tone="loud"))}, "must be one of secondary, accent"),
        ({"home": screen(section(gap="13px"))}, "must be a space.stack token"),
        ({"home": screen(section(gap=13))}, "must be a space.stack token"),
        ({"home": screen(section(gap="space.card.gap"))}, "must be a space.stack token"),
        ({"home": screen(section(gap="space.stack.nope"))}, "unknown token space.stack.nope"),
    ])
    def test_invalid_layouts_are_refused(self, layouts, message):
        with pytest.raises(LayoutError, match=message):
            check(layouts)

    def test_a_section_needs_its_tokens_on_this_brand(self):
        tokens = {"semantic": {"other": {"$value": "1"}}}
        with pytest.raises(LayoutError, match="needs the token colour.text.primary"):
            check(LAYOUTS, tokens=tokens)

    def test_an_unused_sections_tokens_are_not_required(self):
        tokens = {"semantic": {"other": {"$value": "1"}}}
        check({"home": screen({"id": "n", "type": "Note"})}, tokens=tokens)


class TestDiff:
    def severity(self, before, after):
        return worst_severity(diff_layouts({"home": before}, {"home": after}))

    def test_identical_layouts_have_no_changes(self):
        assert diff_layouts(LAYOUTS, copy.deepcopy(LAYOUTS)) == []

    def test_no_records_means_no_severity(self):
        assert worst_severity([]) == ""

    def test_removing_a_screen_is_major(self):
        assert worst_severity(diff_layouts(LAYOUTS, {})) == "major"

    def test_adding_a_screen_is_minor(self):
        records = diff_layouts({}, LAYOUTS)
        assert (records[0]["path"], records[0]["severity"]) == ("layout.home", "minor")

    def test_removing_a_section_is_major(self):
        assert self.severity(screen(section("a"), section("b")), screen(section("a"))) == "major"

    def test_adding_a_section_is_minor(self):
        assert self.severity(screen(section("a")), screen(section("a"), section("b"))) == "minor"

    def test_reordering_sections_is_minor(self):
        records = diff_layouts(
            {"home": screen(section("a"), section("b"))},
            {"home": screen(section("b"), section("a"))})
        assert [r["reason"] for r in records] == ["sections reordered"]

    def test_inserting_a_section_is_not_a_reorder(self):
        records = diff_layouts(
            {"home": screen(section("a"), section("b"))},
            {"home": screen(section("a"), section("new"), section("b"))})
        assert [r["kind"] for r in records] == ["added"]

    def test_changing_a_prop_is_a_patch_with_before_and_after(self):
        records = diff_layouts({"home": screen(section("a"))},
                               {"home": screen(section("a", title="Bye"))})
        assert records[0]["severity"] == "patch"
        assert records[0]["after"]["props"]["title"] == "Bye"

    def test_changing_a_sections_type_is_major(self):
        assert self.severity(screen(section("a")), screen(section("a", kind="Note"))) == "major"

    def test_a_section_without_props_compares_as_empty(self):
        bare = {"id": "n", "type": "Note"}
        assert self.severity(screen(bare), screen({**bare, "props": {}})) == ""


class TestRealFiles:
    @pytest.mark.parametrize("brand", ["clementine", "kumquat", "pomelo"])
    def test_every_seed_layout_is_valid(self, brand):
        tokens = json.loads((REPO / "tokens" / f"{brand}.tokens.json").read_text(encoding="utf-8"))
        layouts = json.loads((REPO / "layouts" / f"{brand}.layouts.json").read_text(encoding="utf-8"))
        validate_layouts(layouts, load_contract(REPO / "contracts" / "components.json"),
                         resolve_document(tokens))


@pytest.fixture
def store_root(settings, tmp_path):
    settings.ARTIFACT_ROOT = tmp_path
    contract = tmp_path / "contract.json"
    contract.write_text(json.dumps(CONTRACT), encoding="utf-8")
    settings.COMPONENT_CONTRACT = contract
    return tmp_path


@pytest.fixture
def brand(db):
    return Brand.objects.create(slug="pomelo", name="Pomelo", principle="p")


@pytest.fixture
def v1(brand, store_root):
    return TokenSet.objects.create(brand=brand, tokens=TOKENS, layouts=LAYOUTS).publish()


def publish_next(previous, layouts, **kwargs):
    draft = previous.fork()
    draft.layouts = layouts
    draft.save()
    return draft.publish(**kwargs)


def latest_home(root):
    return json.loads((root / "pomelo" / "latest" / "screens" / "home.json").read_text("utf-8"))


class TestPublishing:
    def test_screens_are_written_to_the_version_and_latest(self, v1, store_root):
        assert latest_home(store_root) == LAYOUTS["home"]
        assert (store_root / "pomelo" / "v1" / "screens" / "home.json").exists()

    def test_an_invalid_layout_stays_a_draft_and_writes_nothing(self, brand, store_root):
        draft = TokenSet.objects.create(
            brand=brand, tokens=TOKENS, layouts={"home": screen(section(kind="Carousel"))})
        with pytest.raises(ValidationError, match="unknown section type"):
            draft.publish()
        draft.refresh_from_db()
        assert draft.status == TokenSet.Status.DRAFT
        assert not (store_root / "pomelo").exists()

    def test_a_layout_change_is_recorded_on_the_release(self, v1):
        v2 = publish_next(v1, {"home": screen(section(title="Bye"))})
        assert (v2.severity, v2.compared_to) == ("patch", 1)
        assert v2.changes[0]["path"] == "layout.home.intro"

    def test_removing_a_section_is_gated(self, v1, store_root):
        with pytest.raises(ValidationError, match="layout.home.intro"):
            publish_next(v1, {"home": screen()})
        assert latest_home(store_root) == LAYOUTS["home"]

    def test_a_removed_screen_leaves_latest_when_allowed(self, v1, store_root):
        publish_next(v1, {}, allow_major=True)
        assert not (store_root / "pomelo" / "latest" / "screens" / "home.json").exists()
        assert (store_root / "pomelo" / "v1" / "screens" / "home.json").exists()

    def test_fork_carries_the_layouts(self, v1):
        assert v1.fork().layouts == LAYOUTS

    def test_published_layouts_are_immutable(self, v1):
        v1.layouts = {}
        with pytest.raises(ValidationError, match="changed layouts"):
            v1.save()

    def test_clearing_layouts_on_a_draft_stores_an_empty_object(self, brand):
        draft = TokenSet.objects.create(brand=brand, tokens=TOKENS, layouts=None)
        draft.refresh_from_db()
        assert draft.layouts == {}
