import copy
import json
import tempfile
from pathlib import Path

from django.core.exceptions import ValidationError
from django.test import TestCase, override_settings

from .models import Brand, TokenSet

DOCUMENT = {
    "primitive": {"colour": {"$type": "color", "green": {"600": {"$value": "#2f7a3f"}}}},
    "semantic": {"colour": {"$type": "color", "action": {
        "bg": {"$value": "{primitive.colour.green.600}"},
    }}},
}


def with_value(document, value):
    document = copy.deepcopy(document)
    document["primitive"]["colour"]["green"]["600"]["$value"] = value
    return document


class PublishBuildsTests(TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp())
        self.settings_override = override_settings(ARTIFACT_ROOT=self.root)
        self.settings_override.enable()
        self.brand = Brand.objects.create(slug="pomelo", name="Pomelo", principle="")

    def tearDown(self):
        self.settings_override.disable()

    def css(self, target):
        return (self.root / "pomelo" / target / "theme.css").read_text(encoding="utf-8")

    def test_publishing_writes_the_version_and_latest(self):
        TokenSet.objects.create(brand=self.brand, tokens=DOCUMENT).publish()
        assert "--colour-action-bg: #2f7a3f;" in self.css("v1")
        assert "--colour-action-bg: #2f7a3f;" in self.css("latest")
        bundle = json.loads((self.root / "pomelo" / "latest" / "tokens.json").read_text())
        assert bundle["tokens"]["semantic.colour.action.bg"]["value"] == "#2f7a3f"

    def test_an_edit_published_from_the_admin_reaches_the_css(self):
        v1 = TokenSet.objects.create(brand=self.brand, tokens=DOCUMENT).publish()
        draft = v1.fork()
        draft.tokens = with_value(DOCUMENT, "#1f5a2c")
        draft.save()
        draft.publish()
        assert "--colour-action-bg: #1f5a2c;" in self.css("latest")
        assert "--colour-action-bg: #2f7a3f;" in self.css("v1")

    def test_a_set_that_does_not_resolve_stays_a_draft_and_writes_nothing(self):
        broken = copy.deepcopy(DOCUMENT)
        broken["semantic"]["colour"]["action"]["bg"]["$value"] = "{primitive.colour.missing}"
        draft = TokenSet.objects.create(brand=self.brand, tokens=broken)
        with self.assertRaises(ValidationError):
            draft.publish()
        draft.refresh_from_db()
        assert draft.status == TokenSet.Status.DRAFT
        assert not (self.root / "pomelo").exists()

    def test_publishing_an_older_draft_does_not_move_latest(self):
        old = TokenSet.objects.create(brand=self.brand, tokens=with_value(DOCUMENT, "#000000"))
        TokenSet.objects.create(brand=self.brand, tokens=DOCUMENT).publish()
        old.publish()
        assert "#000000" in self.css("v1")
        assert "--colour-action-bg: #2f7a3f;" in self.css("latest")

    def test_a_published_set_cannot_be_published_again(self):
        published = TokenSet.objects.create(brand=self.brand, tokens=DOCUMENT).publish()
        with self.assertRaises(ValidationError):
            published.publish()
