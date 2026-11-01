import copy
import json

import pytest

from tokens.admin import TokenSetAdmin
from tokens.models import Brand, TokenSet

from .test_versioning import DOCUMENT, edit

CHANGELIST = "/admin/tokens/tokenset/"


@pytest.fixture(autouse=True)
def store_root(settings, tmp_path):
    settings.ARTIFACT_ROOT = tmp_path
    return tmp_path


@pytest.fixture
def brand(db):
    return Brand.objects.create(slug="pomelo", name="Pomelo", principle="p")


def run_action(client, action, *sets):
    response = client.post(
        CHANGELIST,
        {"action": action, "_selected_action": [s.pk for s in sets]},
        follow=True,
    )
    assert response.status_code == 200
    return [str(m) for m in response.context["messages"]]


def draft_after(v1, document):
    draft = v1.fork()
    draft.tokens = document
    draft.save()
    return draft


class TestPublishActions:
    def test_publishing_a_draft(self, admin_client, brand):
        draft = TokenSet.objects.create(brand=brand, tokens=DOCUMENT)
        messages = run_action(admin_client, "publish_selected", draft)
        assert messages == ["Published and built 1 set(s)."]
        draft.refresh_from_db()
        assert draft.status == TokenSet.Status.PUBLISHED

    def test_a_patch_release_reports_its_severity(self, admin_client, brand):
        v1 = TokenSet.objects.create(brand=brand, tokens=DOCUMENT).publish()
        draft = draft_after(v1, edit("primitive.colour.green.600", "#000000"))
        messages = run_action(admin_client, "publish_selected", draft)
        assert "pomelo v2 (published): patch release against v1 (2 change(s))." in messages

    def test_a_major_change_is_refused_with_a_warning(self, admin_client, brand):
        v1 = TokenSet.objects.create(brand=brand, tokens=DOCUMENT).publish()
        draft = draft_after(v1, edit("semantic.colour.action.bg-hover", delete=True))
        messages = run_action(admin_client, "publish_selected", draft)
        assert len(messages) == 1 and "is a major change against v1" in messages[0]
        draft.refresh_from_db()
        assert draft.status == TokenSet.Status.DRAFT

    def test_the_accepting_action_publishes_a_major_change(self, admin_client, brand):
        v1 = TokenSet.objects.create(brand=brand, tokens=DOCUMENT).publish()
        draft = draft_after(v1, edit("semantic.colour.action.bg-hover", delete=True))
        messages = run_action(admin_client, "publish_allowing_major", draft)
        assert "Published and built 1 set(s)." in messages
        draft.refresh_from_db()
        assert draft.severity == "major"

    def test_a_published_set_in_the_selection_is_reported_not_republished(self, admin_client, brand):
        v1 = TokenSet.objects.create(brand=brand, tokens=DOCUMENT).publish()
        draft = TokenSet.objects.create(brand=brand, tokens=DOCUMENT)
        messages = run_action(admin_client, "publish_selected", v1, draft)
        assert "pomelo v1 (published): pomelo v1 (published) is not a draft" in messages
        assert "Published and built 1 set(s)." in messages

    def test_a_set_that_does_not_resolve_is_reported(self, admin_client, brand):
        draft = TokenSet.objects.create(
            brand=brand, tokens=edit("semantic.colour.action.bg", "{primitive.nope}"))
        messages = run_action(admin_client, "publish_selected", draft)
        assert len(messages) == 1 and "does not resolve" in messages[0]


class TestOtherActions:
    def test_fork(self, admin_client, brand):
        v1 = TokenSet.objects.create(brand=brand, tokens=DOCUMENT).publish()
        assert run_action(admin_client, "fork_selected", v1) == ["Created pomelo v2 (draft)."]
        assert TokenSet.objects.get(brand=brand, version=2).note == "forked from v1"

    def test_rebuild_skips_drafts(self, admin_client, brand):
        v1 = TokenSet.objects.create(brand=brand, tokens=DOCUMENT).publish()
        draft = TokenSet.objects.create(brand=brand, tokens=DOCUMENT)
        messages = run_action(admin_client, "rebuild_selected", v1, draft)
        assert messages == ["Rebuilt pomelo v1 (published) into pomelo/latest, pomelo/v1."]


class TestForms:
    def test_the_raw_change_report_is_never_an_editable_field(self, admin_client, brand):
        v1 = TokenSet.objects.create(brand=brand, tokens=DOCUMENT).publish()
        draft = TokenSet.objects.create(brand=brand, tokens=DOCUMENT)
        for token_set in (v1, draft):
            page = admin_client.get(f"{CHANGELIST}{token_set.pk}/change/").content.decode()
            assert 'name="changes"' not in page

    def test_published_tokens_are_read_only(self, admin_client, brand):
        v1 = TokenSet.objects.create(brand=brand, tokens=DOCUMENT).publish()
        response = admin_client.get(f"{CHANGELIST}{v1.pk}/change/")
        assert response.status_code == 200
        assert 'name="tokens"' not in response.content.decode()

    def test_draft_tokens_are_editable_and_saved(self, admin_client, brand):
        draft = TokenSet.objects.create(brand=brand, tokens=DOCUMENT)
        page = admin_client.get(f"{CHANGELIST}{draft.pk}/change/").content.decode()
        assert 'name="tokens"' in page
        edited = edit("primitive.colour.green.600", "#000000")
        response = admin_client.post(f"{CHANGELIST}{draft.pk}/change/", {
            "brand": brand.pk, "tokens": json.dumps(edited), "note": "darker",
        })
        assert response.status_code == 302
        draft.refresh_from_db()
        assert draft.tokens == edited and draft.note == "darker"

    def test_the_change_page_shows_the_report(self, admin_client, brand):
        v1 = TokenSet.objects.create(brand=brand, tokens=DOCUMENT).publish()
        v2 = draft_after(v1, edit("primitive.colour.green.600", "#000000")).publish()
        page = admin_client.get(f"{CHANGELIST}{v2.pk}/change/").content.decode()
        assert "<b>patch</b> primitive.colour.green.600 — value changed" in page

    def test_the_brand_page_lists_its_versions(self, admin_client, brand):
        TokenSet.objects.create(brand=brand, tokens=DOCUMENT, note="first draft")
        page = admin_client.get(f"/admin/tokens/brand/{brand.pk}/change/").content.decode()
        assert "first draft" in page

    def test_the_changelist_filters_by_severity(self, admin_client, brand):
        TokenSet.objects.create(brand=brand, tokens=DOCUMENT)
        assert admin_client.get(f"{CHANGELIST}?severity=patch").status_code == 200


class TestChangeReportDisplay:
    def test_an_empty_report_is_a_dash(self, brand):
        draft = TokenSet(brand=brand, tokens=DOCUMENT)
        assert TokenSetAdmin.change_report(None, draft) == "—"

    def test_paths_are_escaped(self, brand):
        draft = TokenSet(brand=brand, tokens=DOCUMENT, changes=[
            {"severity": "minor", "path": "<script>", "reason": "added"}])
        html = TokenSetAdmin.change_report(None, copy.copy(draft))
        assert "&lt;script&gt;" in html and "<script>" not in html
