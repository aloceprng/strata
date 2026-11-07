import copy
import io
import json
from pathlib import Path

import pytest
from django.core.exceptions import ValidationError
from django.core.management import call_command

from strata_core import (
    CatalogueError,
    LayoutError,
    diff_catalogues,
    resolve_document,
    validate_catalogue,
    validate_layouts,
    worst_severity,
)
from tokens.models import Brand, TokenSet

REPO = Path(__file__).resolve().parents[2]

CATALOGUE = {
    "schemaVersion": 1,
    "currency": {"code": "USD", "decimals": 2},
    "delivery": {"fee": 3.99},
    "categories": {"fruit-veg": {"name": "Fruit & veg"}},
    "products": {
        "lemons": {
            "name": "Lemons", "price": 0.69, "image": "/products/clementine/lemon.png",
            "category": "fruit-veg", "offer": {"type": "multibuy", "quantity": 2, "price": 1.0},
            "related": ["mango"],
        },
        "mango": {"name": "Mango", "price": 1.99, "image": "/products/clementine/mango.png"},
    },
    "basket": [{"product": "lemons", "quantity": 2}],
}

CONTRACT = {
    "schemaVersion": 1,
    "sections": {
        "Row": {"props": {
            "products": {"type": "products", "max": 2},
            "link": {"type": "link"},
        }},
        "Overview": {"context": "product", "props": {}},
    },
}
TOKENS = {"semantic": {"space": {"stack": {"gap": {"$type": "dimension", "$value": "8px"}}}}}


def with_change(change):
    catalogue = copy.deepcopy(CATALOGUE)
    change(catalogue)
    return catalogue


def screen(name, *sections, **extra):
    return {"schemaVersion": 1, "screen": name, "sections": list(sections), **extra}


def row(**props):
    return {"id": "row", "type": "Row", "props": props}


def check(layouts, catalogue=CATALOGUE):
    validate_layouts(layouts, CONTRACT, resolve_document(TOKENS), catalogue)


class TestCatalogueValidation:
    def test_a_valid_catalogue_passes(self):
        validate_catalogue(CATALOGUE)

    def test_a_brand_may_have_no_catalogue(self):
        validate_catalogue({})
        validate_catalogue(None)

    @pytest.mark.parametrize("brand", ["clementine", "pomelo"])
    def test_the_real_catalogues_are_valid(self, brand):
        validate_catalogue(json.loads(
            (REPO / "catalogue" / f"{brand}.catalogue.json").read_text(encoding="utf-8")))

    @pytest.mark.parametrize("change, message", [
        (lambda c: c.update(schemaVersion=2), "schema version"),
        (lambda c: c.pop("currency"), "missing 'currency'"),
        (lambda c: c["products"]["mango"].pop("price"), "missing 'price'"),
        (lambda c: c["products"]["mango"].update(price=0), "at least 0.01"),
        (lambda c: c["products"]["mango"].update(price=True), "must be a number"),
        (lambda c: c["products"]["mango"].update(image="mango.png"), "image path"),
        (lambda c: c["products"]["mango"].update(colour="red"), "unknown field 'colour'"),
        (lambda c: c["products"]["mango"].update(category="dairy"), "unknown category"),
        (lambda c: c["products"]["mango"].update(related=["kiwi"]), "'kiwi', which is not"),
        (lambda c: c["products"]["mango"].update(tag={"label": "New", "tone": "loud"}), "one of deal"),
        (lambda c: c["products"]["mango"].update(offer={"type": "bogof"}), "multibuy or free"),
        (lambda c: c["products"]["mango"].update(offer={"type": "multibuy", "quantity": 1, "price": 1}),
         "at least 2"),
        (lambda c: c["products"]["mango"].update(
            options={"label": "Colour", "choices": [{"name": "Red", "swatch": "red"}]}), "#14602a"),
        (lambda c: c["products"].update({"Big Mango": c["products"]["mango"]}), "lowercase id"),
        (lambda c: c["basket"].append({"product": "kiwi", "quantity": 1}), "'kiwi', which is not"),
        (lambda c: c["basket"].append({"product": "mango", "quantity": 0}), "at least 1"),
        (lambda c: c.update(saved="mango"), "must be a list"),
        (lambda c: c.update(products=[]), "keyed by id"),
    ])
    def test_refuses(self, change, message):
        with pytest.raises(CatalogueError, match=message):
            validate_catalogue(with_change(change))


class TestCatalogueDiff:
    def severity(self, after):
        return worst_severity(diff_catalogues(CATALOGUE, after))

    def test_no_change(self):
        assert diff_catalogues(CATALOGUE, copy.deepcopy(CATALOGUE)) == []

    def test_removing_a_product_is_major(self):
        assert self.severity(with_change(lambda c: c["products"].pop("mango"))) == "major"

    def test_adding_a_product_is_minor(self):
        assert self.severity(with_change(
            lambda c: c["products"].update(kiwi=c["products"]["mango"]))) == "minor"

    def test_a_price_change_is_a_patch(self):
        records = diff_catalogues(CATALOGUE, with_change(lambda c: c["products"]["mango"].update(price=2.49)))
        assert [(r["path"], r["severity"]) for r in records] == [("catalogue.mango", "patch")]

    def test_a_delivery_change_is_a_patch(self):
        assert self.severity(with_change(lambda c: c["delivery"].update(fee=0))) == "patch"

    def test_an_empty_catalogue_compares_cleanly(self):
        assert diff_catalogues(None, {}) == []


class TestLayoutReferences:
    def test_products_and_links_resolve(self):
        check({
            "home": screen("home", row(products=["lemons", "mango"], link="basket")),
            "basket": screen("basket"),
            "product": screen("product", {"id": "o", "type": "Overview"}),
        })

    def test_a_link_may_name_a_product(self):
        check({"home": screen("home", row(link="product/mango"))})

    @pytest.mark.parametrize("props, message", [
        ({"products": ["kiwi"]}, "'kiwi', which is not in the catalogue"),
        ({"products": "mango"}, "list of product ids"),
        ({"products": ["mango", "mango", "lemons"]}, "between 0 and 2"),
        ({"link": "checkout"}, "'checkout', which is not a screen"),
        ({"link": "https://example.com"}, "not a screen"),
        ({"link": "product/kiwi"}, "'kiwi', which is not in the catalogue"),
        ({"link": "product"}, "not a screen"),
        ({"link": 3}, "screen name or product"),
    ])
    def test_refuses(self, props, message):
        with pytest.raises(LayoutError, match=message):
            check({"home": screen("home", row(**props))})

    def test_products_need_a_catalogue(self):
        with pytest.raises(LayoutError, match="not in the catalogue"):
            check({"home": screen("home", row(products=["mango"]))}, catalogue=None)

    def test_a_product_section_belongs_on_the_product_screen(self):
        with pytest.raises(LayoutError, match="belongs on the product screen"):
            check({"home": screen("home", {"id": "o", "type": "Overview"})})

    def test_a_screen_may_set_its_gap_from_a_space_token(self):
        check({"home": screen("home", gap="space.stack.gap")})

    @pytest.mark.parametrize("gap", ["24px", "colour.text.primary", "space.stack.huge"])
    def test_a_screen_gap_must_be_a_known_space_token(self, gap):
        with pytest.raises(LayoutError, match="home.gap"):
            check({"home": screen("home", gap=gap)})


@pytest.fixture
def store_root(settings, tmp_path):
    settings.ARTIFACT_ROOT = tmp_path
    contract = tmp_path / "contract.json"
    contract.write_text(json.dumps(CONTRACT), encoding="utf-8")
    settings.COMPONENT_CONTRACT = contract
    return tmp_path


@pytest.fixture
def v1(db, store_root):
    brand = Brand.objects.create(slug="clementine", name="Clementine", principle="p")
    return TokenSet.objects.create(
        brand=brand, tokens=TOKENS, catalogue=CATALOGUE,
        layouts={"home": screen("home", row(products=["mango"]))},
    ).publish()


class TestPublishing:
    def test_the_catalogue_is_written_beside_the_screens(self, v1, store_root):
        written = store_root / "clementine" / "latest" / "catalogue.json"
        assert json.loads(written.read_text(encoding="utf-8")) == CATALOGUE

    def test_fork_carries_the_catalogue(self, v1):
        assert v1.fork().catalogue == CATALOGUE

    def test_the_published_catalogue_is_immutable(self, v1):
        v1.catalogue = {}
        with pytest.raises(ValidationError, match="changed catalogue"):
            v1.save()

    def test_removing_a_product_a_layout_shows_is_refused(self, v1):
        draft = v1.fork()
        draft.catalogue = with_change(lambda c: c["products"].pop("mango"))
        draft.save()
        with pytest.raises(ValidationError, match="'mango', which is not in the catalogue"):
            draft.publish(allow_major=True)

    def test_a_price_change_publishes_as_a_patch(self, v1):
        draft = v1.fork()
        draft.catalogue = with_change(lambda c: c["products"]["mango"].update(price=2.49))
        draft.save()
        assert draft.publish().severity == "patch"


@pytest.mark.django_db
class TestSeedUpdate:
    @pytest.fixture
    def seeded(self, settings, tmp_path):
        settings.ARTIFACT_ROOT = tmp_path / "artifacts"
        call_command("seed", stdout=io.StringIO())

    def test_the_seed_publishes_each_catalogue(self, seeded, settings):
        clementine = TokenSet.objects.get(brand__slug="clementine")
        assert "navel-oranges" in clementine.catalogue["products"]
        assert (settings.ARTIFACT_ROOT / "pomelo" / "latest" / "catalogue.json").exists()

    def test_update_with_unchanged_files_publishes_nothing(self, seeded):
        call_command("seed", "--update", stdout=io.StringIO())
        assert TokenSet.objects.count() == 3

    def test_update_publishes_changed_files_as_a_new_version(self, seeded):
        v1 = TokenSet.objects.get(brand__slug="pomelo")
        TokenSet.objects.filter(pk=v1.pk).update(catalogue={})
        call_command("seed", "--update", stdout=io.StringIO())
        latest = Brand.objects.get(slug="pomelo").latest_published()
        assert (latest.version, latest.severity) == (2, "minor")
        assert latest.note == "updated from the hand-authored files"
