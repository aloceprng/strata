from django.contrib import admin, messages
from django.core.exceptions import ValidationError

from .models import Brand, TokenSet


class TokenSetInline(admin.TabularInline):
    model = TokenSet
    extra = 0
    fields = ("version", "status", "note", "published_at")
    readonly_fields = ("version", "published_at")
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
    readonly_fields = ("version", "published_at", "created_at")
    actions = ["publish_selected", "fork_selected"]

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
        for token_set in queryset:
            try:
                token_set.publish()
                published += 1
            except ValidationError as exc:
                self.message_user(request, f"{token_set}: {exc.message}", messages.WARNING)
        if published:
            self.message_user(request, f"Published {published} set(s).", messages.SUCCESS)

    @admin.action(description="Fork into a new draft")
    def fork_selected(self, request, queryset):
        for token_set in queryset:
            draft = token_set.fork(note=f"forked from v{token_set.version}")
            self.message_user(request, f"Created {draft}.", messages.SUCCESS)
