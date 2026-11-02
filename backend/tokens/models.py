from django.contrib.postgres.indexes import GinIndex
from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.utils import timezone

from strata_core import worst_severity

from .build import changes, render, write

class Brand(models.Model):
    slug = models.SlugField(unique=True)
    name = models.CharField(max_length=120)
    principle = models.CharField(
        max_length=200,
        help_text=(
            "One sentence, written before any values are chosen. Every token on this "
            "brand is checked against it. e.g. 'Density is a feature; never trade "
            "information for elegance.'"
        ),
    )
    sector = models.CharField(max_length=80, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name

    @property
    def published_sets(self):
        return self.token_sets.filter(status=TokenSet.Status.PUBLISHED)

    def latest_published(self) -> "TokenSet | None":
        return self.published_sets.order_by("-version").first()

class TokenSet(models.Model):

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PUBLISHED = "published", "Published"
        DEPRECATED = "deprecated", "Deprecated"

    class Severity(models.TextChoices):
        PATCH = "patch", "Patch"
        MINOR = "minor", "Minor"
        MAJOR = "major", "Major"

    brand = models.ForeignKey(Brand, on_delete=models.CASCADE, related_name="token_sets")
    version = models.PositiveIntegerField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)

    tokens = models.JSONField(default=dict)
    layouts = models.JSONField(default=dict, blank=True)

    note = models.CharField(max_length=200, blank=True)

    compared_to = models.PositiveIntegerField(
        null=True, blank=True,
        help_text="The published version this set was diffed against when it was published.",
    )
    severity = models.CharField(max_length=8, choices=Severity.choices, blank=True)
    changes = models.JSONField(default=list, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["brand__name", "-version"]
        constraints = [
            models.UniqueConstraint(fields=["brand", "version"], name="unique_brand_version"),
            models.CheckConstraint(
                condition=models.Q(status="draft", published_at__isnull=True)
                | ~models.Q(status="draft"),
                name="draft_has_no_published_at",
            ),
        ]
        indexes = [
            models.Index(fields=["brand", "status"], name="tokenset_brand_status"),
            GinIndex(fields=["tokens"], name="tokenset_tokens_gin"),
        ]

    def __str__(self) -> str:
        return f"{self.brand.slug} v{self.version} ({self.status})"

    @property
    def label(self) -> str:
        return f"v{self.version}"

    def save(self, *args, **kwargs):
        if self.version is None:
            self.version = self.next_version(self.brand)
        if self.layouts is None:
            self.layouts = {}
        self.check_immutable()
        super().save(*args, **kwargs)

    def clean(self):
        self.check_immutable()

    def check_immutable(self):
        if not self.pk:
            return
        previous = TokenSet.objects.filter(pk=self.pk).first()
        if previous and previous.status == self.Status.PUBLISHED:
            changed = [
                field
                for field in ("tokens", "layouts", "version", "brand_id")
                if getattr(previous, field) != getattr(self, field)
            ]
            if changed:
                raise ValidationError(
                    f"{previous} is published and immutable; changed {', '.join(changed)}. "
                    f"Create version {self.next_version(self.brand)} instead."
                )

    @staticmethod
    def next_version(brand: Brand) -> int:
        highest = TokenSet.objects.filter(brand=brand).aggregate(models.Max("version"))
        return (highest["version__max"] or 0) + 1

    def baseline(self) -> "TokenSet | None":
        return (
            self.brand.published_sets
            .filter(version__lt=self.version)
            .order_by("-version")
            .first()
        )

    def publish(self, store=None, *, allow_major: bool = False) -> "TokenSet":
        if self.status != self.Status.DRAFT:
            raise ValidationError(f"{self} is not a draft")
        outputs = render(self)

        baseline = self.baseline()
        records = changes(self, baseline) if baseline else []
        severity = worst_severity(records)
        if severity == self.Severity.MAJOR and not allow_major:
            breaking = ", ".join(r["path"] for r in records if r["severity"] == severity)
            raise ValidationError(
                f"{self} is a major change against {baseline.label} ({breaking}). "
                f"Publish it with major changes allowed, or undo those changes."
            )

        with transaction.atomic():
            self.status = self.Status.PUBLISHED
            self.published_at = timezone.now()
            self.compared_to = baseline.version if baseline else None
            self.severity = severity
            self.changes = records
            self.save(update_fields=[
                "status", "published_at", "compared_to", "severity", "changes",
            ])
            write(self, outputs, store)
        return self

    def is_latest_published(self) -> bool:
        return not self.brand.published_sets.filter(version__gt=self.version).exists()

    def fork(self, note: str = "") -> "TokenSet":

        return TokenSet.objects.create(
            brand=self.brand,
            version=self.next_version(self.brand),
            tokens=self.tokens,
            layouts=self.layouts,
            note=note,
            status=self.Status.DRAFT,
        )
