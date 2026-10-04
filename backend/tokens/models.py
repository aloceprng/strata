from django.contrib.postgres.indexes import GinIndex
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

class Brand(models.Model):
    slug = models.SlugField(unique=True)
    name = models.CharField(max_length=120)
    principle = models.CharField(
        max_length=200,
        help_text=(
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

    brand = models.ForeignKey(Brand, on_delete=models.CASCADE, related_name="token_sets")
    version = models.PositiveIntegerField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)

    tokens = models.JSONField(default=dict)

    note = models.CharField(max_length=200, blank=True)
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
        super().save(*args, **kwargs)

    def clean(self):
        
        if not self.pk:
            return
        previous = TokenSet.objects.filter(pk=self.pk).first()
        if previous and previous.status == self.Status.PUBLISHED:
            changed = [
                field
                for field in ("tokens", "version", "brand_id")
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

    def publish(self) -> "TokenSet":

        if self.status != self.Status.DRAFT:
            raise ValidationError(f"{self} is not a draft")
        self.status = self.Status.PUBLISHED
        self.published_at = timezone.now()
        self.save(update_fields=["status", "published_at"])
        return self

    def fork(self, note: str = "") -> "TokenSet":

        return TokenSet.objects.create(
            brand=self.brand,
            version=self.next_version(self.brand),
            tokens=self.tokens,
            note=note,
            status=self.Status.DRAFT,
        )
