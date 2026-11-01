from django.contrib import admin, messages
from django.core.exceptions import ValidationError
from django.utils.html import format_html_join

from .build import build
from .models import Brand, TokenSet

class TokenSetInline(admin.TabularInline):
    model = TokenSet
    extra = 0
    fields = ("version", "status", "note", "published_at")
    readonly_fields = ("version", "status", "published_at")
    show_change_link = True
    can_delete = False

@admin.register(Brand)
class BrandAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "sector", "principle")
    prepopulated_fields = {"slug": ("name",)}
    inlines = [TokenSetInline]

@admin.register(TokenSet)
class TokenSetAdmin(admin.ModelAdmin):
    list_display = ("brand", "version", "status", "severity", "note", "published_at")
    list_filter = ("brand", "status", "severity")
    exclude = ("changes",)
    readonly_fields = (
        "version", "status", "published_at", "created_at",
        "compared_to", "severity", "change_report",
    )
    actions = ["publish_selected", "publish_allowing_major", "fork_selected", "rebuild_selected"]

    def get_readonly_fields(self, request, obj=None):
        fields = list(super().get_readonly_fields(request, obj))
        if obj and obj.status == TokenSet.Status.PUBLISHED:
            fields += ["tokens", "brand"]
        return fields

    def save_model(self, request, obj, form, change):
        obj.full_clean(exclude=None, validate_unique=False)
        super().save_model(request, obj, form, change)

    @admin.display(description="Changes")
    def change_report(self, obj):
        if not obj.changes:
            return "—"
        return format_html_join(
            "", "<div><b>{}</b> {} — {}</div>",
            ((c["severity"], c["path"], c["reason"]) for c in obj.changes),
        )

    @admin.action(description="Publish selected drafts")
    def publish_selected(self, request, queryset):
        self._publish(request, queryset, allow_major=False)

    @admin.action(description="Publish selected drafts, accepting major changes")
    def publish_allowing_major(self, request, queryset):
        self._publish(request, queryset, allow_major=True)

    def _publish(self, request, queryset, *, allow_major):
        published = 0
        for token_set in queryset.order_by("brand", "version"):
            try:
                token_set.publish(allow_major=allow_major)
                published += 1
            except ValidationError as exc:
                self.message_user(request, f"{token_set}: {exc.message}", messages.WARNING)
                continue
            if token_set.severity:
                self.message_user(
                    request,
                    f"{token_set}: {token_set.severity} release against v{token_set.compared_to} "
                    f"({len(token_set.changes)} change(s)).",
                    messages.INFO,
                )
        if published:
            self.message_user(
                request, f"Published and built {published} set(s).", messages.SUCCESS
            )

    @admin.action(description="Rebuild CSS for selected published sets")
    def rebuild_selected(self, request, queryset):
        for token_set in queryset.filter(status=TokenSet.Status.PUBLISHED):
            written = build(token_set)
            paths = ", ".join(sorted({a.path.rsplit("/", 1)[0] for a in written}))
            self.message_user(request, f"Rebuilt {token_set} into {paths}.", messages.SUCCESS)

    @admin.action(description="Fork into a new draft")
    def fork_selected(self, request, queryset):
        for token_set in queryset:
            draft = token_set.fork(note=f"forked from v{token_set.version}")
            self.message_user(request, f"Created {draft}.", messages.SUCCESS)
