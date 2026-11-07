
import json

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from strata_core import StrataError, resolve_document

from ...models import Brand, TokenSet

PLACEHOLDER = "Placeholder: write this brand's principle before designing its values."

BRANDS = {
    "clementine": {"name": "Clementine", "sector": "Grocery", "principle": PLACEHOLDER},
    "pomelo": {"name": "Pomelo", "sector": "Furniture", "principle": PLACEHOLDER},
    "kumquat": {"name": "Kumquat", "sector": "TBD", "principle": PLACEHOLDER},
}

class Command(BaseCommand):
    help = (
        "Load the hand-authored token, layout and catalogue files as published v1 token sets. "
        "With --update, publish a new version for any brand whose files have changed."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Delete existing brands first. Destroys every version.",
        )
        parser.add_argument(
            "--update",
            action="store_true",
            help="Publish the files as a new version when they differ from the latest one, "
                 "accepting major changes. Earlier versions are kept.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        source_dir = settings.TOKEN_SOURCE_DIR
        if not source_dir.exists():
            raise CommandError(f"No token directory at {source_dir}")

        if options["reset"]:
            deleted, _ = Brand.objects.all().delete()
            self.stdout.write(self.style.WARNING(f"Deleted {deleted} row(s)."))

        for slug, details in BRANDS.items():
            source = source_dir / f"{slug}.tokens.json"
            if not source.exists():
                self.stdout.write(self.style.WARNING(f"{slug}: no file at {source}, skipped"))
                continue

            document = json.loads(source.read_text(encoding="utf-8"))
            layouts = read_optional(settings.LAYOUT_SOURCE_DIR / f"{slug}.layouts.json")
            catalogue = read_optional(settings.CATALOGUE_SOURCE_DIR / f"{slug}.catalogue.json")

            try:
                resolved = resolve_document(document)
            except StrataError as exc:
                raise CommandError(f"{slug}: {exc}") from exc

            brand, created = Brand.objects.update_or_create(slug=slug, defaults=details)

            if brand.token_sets.exists() and options["update"]:
                self.update(brand, document, layouts, catalogue)
                continue
            if brand.token_sets.exists():
                self.stdout.write(
                    f"  {slug}: already has "
                    f"{brand.token_sets.count()} version(s), left alone"
                )
                continue

            token_set = TokenSet.objects.create(
                brand=brand,
                version=1,
                tokens=document,
                layouts=layouts,
                catalogue=catalogue,
                note="seeded from the hand-authored file",
            )
            token_set.publish()

            verb = "created" if created else "updated"
            self.stdout.write(
                self.style.SUCCESS(
                    f"  {slug}: {verb}, v1 published — {len(resolved)} tokens, "
                    f"longest alias chain {resolved.max_chain_depth}"
                )
            )

        self.stdout.write(self.style.SUCCESS(f"{Brand.objects.count()} brand(s) in the database."))

    def update(self, brand, document, layouts, catalogue):
        latest = brand.latest_published()
        if latest and (latest.tokens, latest.layouts, latest.catalogue) == (document, layouts, catalogue):
            self.stdout.write(f"  {brand.slug}: files match {latest.label}, nothing to publish")
            return
        draft = TokenSet.objects.create(
            brand=brand,
            tokens=document,
            layouts=layouts,
            catalogue=catalogue,
            note="updated from the hand-authored files",
        )
        try:
            draft.publish(allow_major=True)
        except ValidationError as exc:
            draft.delete()
            raise CommandError(f"{brand.slug}: {exc.messages[0]}") from exc
        self.stdout.write(self.style.SUCCESS(
            f"  {brand.slug}: published {draft.label} ({draft.severity or 'no changes'})"
        ))


def read_optional(path):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
