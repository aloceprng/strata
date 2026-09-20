'''to rebuild the whole system from nothing:
    python manage.py seed
'''

import json

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from strata_core import StrataError, resolve_document

from ...models import Brand, TokenSet

BRANDS = {
    "croftwell": {
        "name": "Croftwell",
        "sector": "Grocery",
        "principle": "Density is a feature; never trade information for elegance.",
    },
    "halden": {
        "name": "Halden & Co.",
        "sector": "Apparel",
        "principle": "One action per screen, unmissable.",
    },
    "meridian": {
        "name": "Meridian Rail",
        "sector": "Travel",
        "principle": "Never rush the traveller.",
    },
}


class Command(BaseCommand):
    help = "Load the hand-authored token files as published v1 token sets."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Delete existing brands first. Destroys every version.",
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

            try:
                resolved = resolve_document(document)
            except StrataError as exc:
                raise CommandError(f"{slug}: {exc}") from exc

            brand, created = Brand.objects.update_or_create(slug=slug, defaults=details)

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
