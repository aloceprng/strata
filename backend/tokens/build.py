from django.conf import settings
from django.core.exceptions import ValidationError

from strata_core import StrataError, resolve_document
from strata_core.emitters import emit_css, emit_json
from strata_core.storage import LocalArtifactStore, StoredArtifact, versioned_path


def default_store() -> LocalArtifactStore:
    return LocalArtifactStore(settings.ARTIFACT_ROOT)

def render(token_set) -> dict[str, str]:
    try:
        resolved = resolve_document(token_set.tokens)
    except StrataError as exc:
        raise ValidationError(f"{token_set} does not resolve: {exc}") from exc
    brand = token_set.brand.slug
    return {
        "theme.css": emit_css(resolved, brand),
        "tokens.json": emit_json(resolved, brand),
    }

def write(token_set, outputs: dict[str, str], store=None) -> list[StoredArtifact]:
    store = store or default_store()
    targets = [token_set.label]
    if token_set.is_latest_published():
        targets.append("latest")

    written = []
    for target in targets:
        for filename, content in outputs.items():
            written.append(store.write(versioned_path(token_set.brand.slug, target, filename), content))
    return written

def build(token_set, store=None) -> list[StoredArtifact]:
    return write(token_set, render(token_set), store)
