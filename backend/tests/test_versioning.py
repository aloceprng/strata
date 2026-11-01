import copy

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from tokens.build import build, compare
from tokens.models import Brand, TokenSet

DOCUMENT = {
    "primitive": {"colour": {"$type": "color", "green": {
        "600": {"$value": "#2f7a3f"}, "700": {"$value": "#245f31"}}}},
    "semantic": {"colour": {"$type": "color", "action": {
        "bg": {"$value": "{primitive.colour.green.600}"},
        "bg-hover": {"$value": "{primitive.colour.green.700}"},
    }}},
}


@pytest.fixture
def store_root(settings, tmp_path):
    settings.ARTIFACT_ROOT = tmp_path
    return tmp_path


@pytest.fixture
def brand(db):
    return Brand.objects.create(slug="kumquat", name="Kumquat", principle="p")


@pytest.fixture
def v1(brand, store_root):
    return TokenSet.objects.create(brand=brand, tokens=DOCUMENT).publish()


def latest_css(root, slug="kumquat"):
    return (root / slug / "latest" / "theme.css").read_text(encoding="utf-8")


def edit(path, value=None, *, delete=False, document=DOCUMENT):
    document = copy.deepcopy(document)
    *parents, leaf = path.split(".")
    node = document
    for key in parents:
        node = node.setdefault(key, {})
    if delete:
        del node[leaf]
    else:
        node[leaf] = {"$value": value}
    return document


def publish_next(previous, document, **kwargs):
    draft = previous.fork()
    draft.tokens = document
    draft.save()
    return draft.publish(**kwargs)


class TestTheChangeReport:
    def test_a_first_version_has_nothing_to_compare_against(self, v1):
        assert (v1.compared_to, v1.severity, v1.changes) == (None, "", [])

    def test_an_unchanged_fork_is_compared_but_has_no_severity(self, v1):
        v2 = publish_next(v1, DOCUMENT)
        assert (v2.compared_to, v2.severity, v2.changes) == (1, "", [])

    def test_a_value_edit_is_a_patch_with_before_and_after(self, v1):
        v2 = publish_next(v1, edit("primitive.colour.green.600", "#000000"))
        v2.refresh_from_db()
        assert v2.severity == "patch"
        cascade = next(c for c in v2.changes if c["path"] == "semantic.colour.action.bg")
        assert cascade == {
            "path": "semantic.colour.action.bg", "kind": "changed", "severity": "patch",
            "reason": "value changed via primitive.colour.green.600", "cause": "cascade",
            "upstream": ["primitive.colour.green.600"], "before": "#2f7a3f", "after": "#000000",
        }

    def test_an_addition_is_a_minor_release(self, v1):
        v2 = publish_next(v1, edit("semantic.colour.action.fg", "#ffffff"))
        assert v2.severity == "minor"
        assert (v2.changes[0]["before"], v2.changes[0]["after"]) == (None, "#ffffff")

    def test_the_release_takes_the_worst_change(self, v1):
        mixed = edit("semantic.colour.action.fg", "#ffffff")
        mixed = edit("semantic.colour.action.bg-hover", delete=True, document=mixed)
        v2 = publish_next(v1, mixed, allow_major=True)
        assert v2.severity == "major"
        assert {c["severity"] for c in v2.changes} == {"major", "minor"}

    def test_the_report_survives_a_round_trip_through_the_database(self, v1):
        publish_next(v1, edit("primitive.colour.green.600", "#000000"))
        stored = TokenSet.objects.get(brand=v1.brand, version=2)
        assert stored.severity == "patch" and len(stored.changes) == 2


class TestMajorChangesAreGated:
    REMOVED = edit("semantic.colour.action.bg-hover", delete=True)

    def test_removing_a_semantic_token_is_refused_by_default(self, v1, store_root):
        draft = v1.fork()
        draft.tokens = self.REMOVED
        draft.save()
        with pytest.raises(ValidationError, match="semantic.colour.action.bg-hover"):
            draft.publish()
        draft.refresh_from_db()
        assert draft.status == TokenSet.Status.DRAFT
        assert (draft.severity, draft.changes, draft.compared_to) == ("", [], None)
        assert not (store_root / "kumquat" / "v2").exists()
        assert "--colour-action-bg-hover" in latest_css(store_root)

    def test_a_major_change_publishes_when_explicitly_allowed(self, v1, store_root):
        v2 = publish_next(v1, self.REMOVED, allow_major=True)
        assert v2.status == TokenSet.Status.PUBLISHED and v2.severity == "major"
        assert "--colour-action-bg-hover" not in latest_css(store_root)

    def test_a_type_change_is_gated(self, v1):
        retyped = copy.deepcopy(DOCUMENT)
        retyped["semantic"]["colour"]["action"]["bg"]["$type"] = "string"
        with pytest.raises(ValidationError, match="major change"):
            publish_next(v1, retyped)

    def test_removing_a_primitive_alone_is_not_gated(self, v1):
        document = edit("semantic.colour.action.bg-hover", "#245f31")
        document = edit("primitive.colour.green.700", delete=True, document=document)
        assert publish_next(v1, document).severity == "minor"


class TestTheBaseline:
    def test_it_is_the_highest_published_version_below(self, brand, v1):
        v2 = publish_next(v1, DOCUMENT)
        TokenSet.objects.create(brand=brand, tokens=DOCUMENT)  # v3 stays a draft
        v4 = TokenSet.objects.create(brand=brand, tokens=DOCUMENT)
        assert v4.baseline() == v2

    def test_a_newer_published_version_is_not_a_baseline(self, brand, store_root):
        old = TokenSet.objects.create(brand=brand, tokens=DOCUMENT)
        TokenSet.objects.create(brand=brand, tokens=DOCUMENT).publish()
        assert old.baseline() is None
        assert old.publish().compared_to is None

    def test_other_brands_are_never_a_baseline(self, brand, store_root):
        other = Brand.objects.create(slug="pomelo", name="Pomelo", principle="p")
        TokenSet.objects.create(brand=other, tokens=DOCUMENT).publish()
        TokenSet.objects.create(brand=brand, tokens=DOCUMENT)
        assert TokenSet.objects.create(brand=brand, tokens=DOCUMENT).baseline() is None

    def test_a_baseline_that_no_longer_resolves_blocks_the_publish(self, brand, v1):
        broken = edit("semantic.colour.action.bg", "{primitive.colour.gone}")
        TokenSet.objects.filter(pk=v1.pk).update(tokens=broken)
        draft = TokenSet.objects.create(brand=brand, tokens=DOCUMENT)
        with pytest.raises(ValidationError, match="cannot diff"):
            draft.publish()
        draft.refresh_from_db()
        assert draft.status == TokenSet.Status.DRAFT

    def test_compare_of_identical_sets_is_empty(self, brand):
        first = TokenSet.objects.create(brand=brand, tokens=DOCUMENT)
        assert compare(TokenSet(brand=brand, tokens=DOCUMENT), first).items == []


class TestImmutability:
    def test_saving_edited_tokens_on_a_published_set_is_refused(self, v1):
        v1.tokens = edit("primitive.colour.green.600", "#000000")
        with pytest.raises(ValidationError, match="immutable; changed tokens"):
            v1.save()
        v1.refresh_from_db()
        assert v1.tokens == DOCUMENT

    def test_moving_a_published_set_to_another_brand_is_refused(self, v1):
        v1.brand = Brand.objects.create(slug="pomelo", name="Pomelo", principle="p")
        with pytest.raises(ValidationError, match="brand_id"):
            v1.save()

    def test_clean_reports_the_same_rule(self, v1):
        v1.version = 9
        with pytest.raises(ValidationError, match="Create version 2 instead"):
            v1.clean()

    def test_the_note_on_a_published_set_can_still_change(self, v1):
        v1.note = "renamed"
        v1.save()
        v1.full_clean()

    def test_drafts_are_freely_editable(self, brand):
        draft = TokenSet.objects.create(brand=brand, tokens=DOCUMENT)
        draft.tokens = edit("primitive.colour.green.600", "#000000")
        draft.save()
        draft.clean()

    def test_an_unsaved_set_has_nothing_to_compare(self, brand):
        TokenSet(brand=brand, tokens=DOCUMENT).clean()


class TestVersioning:
    def test_versions_number_from_one_per_brand(self, brand):
        other = Brand.objects.create(slug="pomelo", name="Pomelo", principle="p")
        assert TokenSet.objects.create(brand=brand, tokens=DOCUMENT).version == 1
        assert TokenSet.objects.create(brand=brand, tokens=DOCUMENT).version == 2
        assert TokenSet.objects.create(brand=other, tokens=DOCUMENT).version == 1

    def test_fork_copies_tokens_into_the_next_draft(self, v1):
        draft = v1.fork(note="try teal")
        assert (draft.version, draft.status, draft.tokens, draft.note) == (
            2, TokenSet.Status.DRAFT, DOCUMENT, "try teal")

    def test_two_sets_cannot_share_a_version(self, brand):
        TokenSet.objects.create(brand=brand, tokens=DOCUMENT, version=1)
        with pytest.raises(IntegrityError), transaction.atomic():
            TokenSet.objects.create(brand=brand, tokens=DOCUMENT, version=1)

    def test_a_draft_cannot_carry_a_published_date(self, brand):
        with pytest.raises(IntegrityError), transaction.atomic():
            TokenSet.objects.create(brand=brand, tokens=DOCUMENT, published_at=timezone.now())

    def test_latest_published_ignores_drafts(self, brand, v1):
        TokenSet.objects.create(brand=brand, tokens=DOCUMENT)
        assert brand.latest_published() == v1
        assert v1.is_latest_published()

    def test_labels_and_names(self, brand):
        draft = TokenSet.objects.create(brand=brand, tokens=DOCUMENT)
        assert (str(brand), draft.label, str(draft)) == ("Kumquat", "v1", "kumquat v1 (draft)")


class TestRebuild:
    def test_rebuilding_an_old_version_leaves_latest_alone(self, v1, store_root):
        publish_next(v1, edit("primitive.colour.green.600", "#111111"))
        written = build(v1)
        assert {a.path.rsplit("/", 1)[0] for a in written} == {"kumquat/v1"}
        assert "#111111" in latest_css(store_root)

    def test_artifacts_report_size_checksum_and_url(self, v1, store_root):
        artifact = build(v1)[0]
        assert artifact.size == len((store_root / artifact.path).read_bytes())
        assert len(artifact.checksum) == 64
        assert artifact.url == f"/artifacts/{artifact.path}"
        assert repr(artifact).startswith(f"<StoredArtifact {artifact.path}")
