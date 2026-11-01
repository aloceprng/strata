import io
import json
import shutil
from pathlib import Path

import pytest
from django.core.management import CommandError, call_command

from tokens.models import Brand, TokenSet

TOKENS_DIR = Path(__file__).resolve().parents[2] / "tokens"


@pytest.fixture
def source(settings, tmp_path):
    settings.ARTIFACT_ROOT = tmp_path / "artifacts"
    target = tmp_path / "tokens"
    shutil.copytree(TOKENS_DIR, target)
    settings.TOKEN_SOURCE_DIR = target
    return target


def seed(*args):
    call_command("seed", *args, stdout=io.StringIO())


@pytest.mark.django_db
class TestSeed:
    def test_every_brand_is_published_as_v1(self, source, settings):
        seed()
        assert sorted(Brand.objects.values_list("slug", flat=True)) == [
            "clementine", "kumquat", "pomelo"]
        for token_set in TokenSet.objects.all():
            assert (token_set.version, token_set.status) == (1, TokenSet.Status.PUBLISHED)
        assert (settings.ARTIFACT_ROOT / "kumquat" / "latest" / "theme.css").exists()

    def test_placeholder_principles_pass_model_validation(self, source):
        seed()
        for brand in Brand.objects.all():
            brand.full_clean()
            assert brand.principle.startswith("Placeholder")

    def test_running_twice_leaves_existing_versions_alone(self, source):
        seed()
        seed()
        assert TokenSet.objects.count() == 3

    def test_reset_starts_over(self, source):
        seed()
        TokenSet.objects.get(brand__slug="pomelo").fork()
        seed("--reset")
        assert TokenSet.objects.count() == 3

    def test_a_missing_brand_file_is_skipped(self, source):
        (source / "pomelo.tokens.json").unlink()
        seed()
        assert not Brand.objects.filter(slug="pomelo").exists()
        assert Brand.objects.count() == 2

    def test_a_broken_file_rolls_back_every_brand(self, source):
        broken = json.loads((source / "pomelo.tokens.json").read_text(encoding="utf-8"))
        broken["semantic"]["colour"]["action"]["bg"]["$value"] = "{semantic.colour.action.bg}"
        (source / "pomelo.tokens.json").write_text(json.dumps(broken), encoding="utf-8")
        with pytest.raises(CommandError, match="pomelo: reference cycle"):
            seed()
        assert Brand.objects.count() == 0

    def test_a_missing_token_directory_is_an_error(self, settings, tmp_path):
        settings.TOKEN_SOURCE_DIR = tmp_path / "nowhere"
        with pytest.raises(CommandError, match="No token directory"):
            seed()
