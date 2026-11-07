import copy
import json

import pytest

from tokens.models import Brand, TokenSet

from .test_layout import screen, section

CONTRACT_TOKENS = {
    "colour": {"text": {
        "primary": {"$type": "color", "$value": "#000"},
        "secondary": {"$type": "color", "$value": "#111"},
    }},
    "font": {
        "heading": {"size": {"$type": "dimension", "$value": "32px"}},
        "body": {"size": {"$type": "dimension", "$value": "16px"}},
    },
    "space": {"stack": {"gap": {"$type": "dimension", "$value": "8px"}}},
}
TOKENS = {"semantic": CONTRACT_TOKENS}
LAYOUTS = {"home": screen(section())}


@pytest.fixture(autouse=True)
def store_root(settings, tmp_path):
    settings.ARTIFACT_ROOT = tmp_path
    return tmp_path


@pytest.fixture
def brand(db):
    return Brand.objects.create(slug="pomelo", name="Pomelo", principle="p")


@pytest.fixture
def published(brand):
    token_set = TokenSet.objects.create(
        brand=brand, tokens=copy.deepcopy(TOKENS), layouts=copy.deepcopy(LAYOUTS),
    )
    return token_set.publish()


def post(client, layouts, slug="pomelo"):
    return client.post(
        f"/api/brands/{slug}/check",
        json.dumps({"layouts": layouts}),
        content_type="application/json",
    )


class TestPipeline:
    def test_lists_versions_newest_first_with_the_published_layouts(self, client, published):
        draft = published.fork("next")
        body = client.get("/api/brands/pomelo/pipeline").json()
        assert [v["version"] for v in body["versions"]] == [draft.version, published.version]
        assert body["versions"][0]["status"] == "draft"
        assert body["layouts"] == LAYOUTS

    def test_a_brand_with_nothing_published_has_no_layouts(self, client, brand):
        assert client.get("/api/brands/pomelo/pipeline").json()["layouts"] == {}

    def test_sends_the_section_contract_as_a_reference(self, client, published):
        ref = client.get("/api/brands/pomelo/pipeline").json()["reference"]
        assert ref["schemaVersion"] == 1
        assert ref["fits"] == ["scroll", "viewport"]
        source = ref["sections"]["ProductRow"]["props"]["source"]
        assert source["values"] == ["list", "related"]
        assert ref["products"] == []

    def test_token_props_list_the_brands_tokens_in_that_group(self, client, published):
        ref = client.get("/api/brands/pomelo/pipeline").json()["reference"]
        assert ref["tokenOptions"] == {"space.stack": ["space.stack.gap"]}

    def test_with_nothing_published_token_options_are_empty(self, client, brand):
        ref = client.get("/api/brands/pomelo/pipeline").json()["reference"]
        assert ref["tokenOptions"] == {"space.stack": []}

    def test_an_unknown_brand_is_404(self, client, db):
        assert client.get("/api/brands/nope/pipeline").status_code == 404


def test_token_paths_skip_dtcg_metadata():
    from tokens.views import token_paths
    tree = {"$description": "x", "space": {"$type": "dimension", "gap": {"$value": "8px"}}}
    assert token_paths(tree) == ["space.gap"]


class TestCheck:
    def test_an_unchanged_layout_is_ready(self, client, published):
        body = post(client, LAYOUTS).json()
        assert body == {"verdict": "ready", "severity": "", "comparedTo": 1, "changes": []}

    def test_an_added_section_is_minor(self, client, published):
        body = post(client, {"home": screen(section(), section("more"))}).json()
        assert (body["verdict"], body["severity"]) == ("ready", "minor")

    def test_a_removed_screen_needs_approval(self, client, published):
        body = post(client, {}).json()
        assert (body["verdict"], body["severity"]) == ("needs-approval", "major")

    def test_a_bad_layout_is_refused_with_the_reason(self, client, published):
        body = post(client, {"home": screen(section(kind="Carousel"))}).json()
        assert body["verdict"] == "refused"
        assert "unknown section type 'Carousel'" in body["error"]

    def test_nothing_is_saved_or_written(self, client, published, store_root):
        before = sorted(store_root.rglob("*"))
        post(client, {"home": screen(section(), section("more"))})
        assert TokenSet.objects.count() == 1
        assert sorted(store_root.rglob("*")) == before

    @pytest.mark.parametrize("body", ["not json", "[]", "{}"])
    def test_a_malformed_request_is_400(self, client, published, body):
        response = client.post("/api/brands/pomelo/check", body, content_type="application/json")
        assert response.status_code == 400

    def test_a_brand_with_nothing_published_is_409(self, client, brand):
        assert post(client, {}).status_code == 409

    def test_get_is_not_allowed(self, client, published):
        assert client.get("/api/brands/pomelo/check").status_code == 405
