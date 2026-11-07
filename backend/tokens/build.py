from django.conf import settings
from django.core.exceptions import ValidationError

from strata_core import (
    Report,
    StrataError,
    classify_diff,
    diff_catalogues,
    diff_documents,
    diff_layouts,
    emit_catalogue,
    emit_layout,
    load_contract,
    resolve_document,
    validate_catalogue,
    validate_layouts,
)
from strata_core.emitters import emit_css, emit_json
from strata_core.storage import LocalArtifactStore, StoredArtifact, versioned_path


def default_store() -> LocalArtifactStore:
    return LocalArtifactStore(settings.ARTIFACT_ROOT)

def render(token_set) -> dict[str, str]:
    try:
        resolved = resolve_document(token_set.tokens)
        validate_catalogue(token_set.catalogue)
        validate_layouts(
            token_set.layouts, load_contract(settings.COMPONENT_CONTRACT), resolved, token_set.catalogue,
        )
    except StrataError as exc:
        raise ValidationError(f"{token_set} does not resolve: {exc}") from exc
    brand = token_set.brand.slug
    outputs = {
        "theme.css": emit_css(resolved, brand),
        "tokens.json": emit_json(resolved, brand),
    }
    if token_set.catalogue:
        outputs["catalogue.json"] = emit_catalogue(token_set.catalogue)
    for screen, layout in token_set.layouts.items():
        outputs[f"screens/{screen}.json"] = emit_layout(layout)
    return outputs

def compare(token_set, baseline) -> Report:
    try:
        return classify_diff(diff_documents(baseline.tokens, token_set.tokens))
    except StrataError as exc:
        raise ValidationError(f"cannot diff {token_set} against {baseline}: {exc}") from exc

def changes(token_set, baseline) -> list[dict]:
    report = compare(token_set, baseline)
    return (
        report.as_records()
        + diff_layouts(baseline.layouts, token_set.layouts)
        + diff_catalogues(baseline.catalogue, token_set.catalogue)
    )

def write(token_set, outputs: dict[str, str], store=None) -> list[StoredArtifact]:
    store = store or default_store()
    targets = [token_set.label]
    if token_set.is_latest_published():
        targets.append("latest")

    written = []
    for target in targets:
        if target == "latest":
            store.clear(versioned_path(token_set.brand.slug, target, "screens"))
        for filename, content in outputs.items():
            written.append(store.write(versioned_path(token_set.brand.slug, target, filename), content))
    return written

def build(token_set, store=None) -> list[StoredArtifact]:
    return write(token_set, render(token_set), store)
