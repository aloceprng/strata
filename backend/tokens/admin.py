from django.contrib import admin, messages
from django.core.exceptions import ValidationError

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
    list_display = ("brand", "version", "status", "note", "published_at")
    list_filter = ("brand", "status")
    readonly_fields = ("version", "status", "published_at", "created_at")
    actions = ["publish_selected", "fork_selected", "rebuild_selected"]

    def get_readonly_fields(self, request, obj=None):
        fields = list(super().get_readonly_fields(request, obj))
        if obj and obj.status == TokenSet.Status.PUBLISHED:
            fields += ["tokens", "brand"]
        return fields

    def save_model(self, request, obj, form, change):
        obj.full_clean(exclude=None, validate_unique=False)
        super().save_model(request, obj, form, change)

    @admin.action(description="Publish selected drafts")
    def publish_selected(self, request, queryset):
        published = 0
        for token_set in queryset.order_by("brand", "version"):
            try:
                token_set.publish()
                published += 1
            except ValidationError as exc:
                self.message_user(request, f"{token_set}: {exc.message}", messages.WARNING)
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
