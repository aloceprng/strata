import json

from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST

from django.conf import settings

from strata_core import load_contract, worst_severity
from strata_core.layout import SCREEN_FITS

from .build import changes, render
from .models import Brand, TokenSet

REFUSED, NEEDS_APPROVAL, READY = "refused", "needs-approval", "ready"

def describe(token_set: TokenSet) -> dict:
    return {
        "version": token_set.version,
        "status": token_set.status,
        "severity": token_set.severity,
        "comparedTo": token_set.compared_to,
        "note": token_set.note,
        "publishedAt": token_set.published_at,
        "changes": token_set.changes,
    }

def token_paths(tree: dict, prefix: str = "") -> list[str]:
    """Every token path in a DTCG tree, e.g. space.stack.gap."""
    paths = []
    for key, node in tree.items():
        if key.startswith("$") or not isinstance(node, dict):
            continue
        path = f"{prefix}{key}"
        paths.extend([path] if "$value" in node else token_paths(node, f"{path}."))
    return paths

def reference(latest: TokenSet | None) -> dict:
    """What a layout may contain: the section contract plus this brand's token choices."""
    contract = load_contract(settings.COMPONENT_CONTRACT)
    available = token_paths(latest.tokens.get("semantic", {})) if latest else []
    have = set(available)
    groups = {
        rule["group"]
        for section in contract["sections"].values()
        for rule in section["props"].values()
        if rule["type"] == "token"
    }
    return {
        "schemaVersion": contract["schemaVersion"],
        "fits": list(SCREEN_FITS),
        "products": sorted((latest.catalogue or {}).get("products", {})) if latest else [],
        "sections": contract["sections"],
        # section types this brand fully supports, for the editor
        "supported": [
            name for name, section in contract["sections"].items()
            if all(token in have for token in section.get("tokens", []))
        ],
        "tokenOptions": {
            group: [p for p in available if p.startswith(f"{group}.")] for group in sorted(groups)
        },
    }

@require_GET
def pipeline(request, slug):
    brand = get_object_or_404(Brand, slug=slug)
    latest = brand.latest_published()
    return JsonResponse({
        "brand": brand.slug,
        "versions": [describe(s) for s in brand.token_sets.order_by("-version")],
        "layouts": latest.layouts if latest else {},
        "reference": reference(latest),
    })

@csrf_exempt
@require_POST
def check(request, slug):
    """Run a draft layout through publish's checks. Nothing is saved or written."""
    brand = get_object_or_404(Brand, slug=slug)
    baseline = brand.latest_published()
    if baseline is None:
        return JsonResponse({"error": f"{slug} has no published version"}, status=409)
    try:
        layouts = json.loads(request.body)["layouts"]
    except (ValueError, KeyError, TypeError):
        return JsonResponse({"error": 'send {"layouts": {...}}'}, status=400)

    draft = TokenSet(
        brand=brand,
        version=TokenSet.next_version(brand),
        tokens=baseline.tokens,
        layouts=layouts,
        catalogue=baseline.catalogue,
    )
    try:
        render(draft)
    except ValidationError as exc:
        return JsonResponse({"verdict": REFUSED, "error": exc.messages[0], "changes": []})

    records = changes(draft, baseline)
    severity = worst_severity(records)
    return JsonResponse({
        "verdict": NEEDS_APPROVAL if severity == TokenSet.Severity.MAJOR else READY,
        "severity": severity,
        "comparedTo": baseline.version,
        "changes": records,
    })
