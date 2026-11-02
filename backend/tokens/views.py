import json

from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST

from strata_core import worst_severity

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

@require_GET
def pipeline(request, slug):
    brand = get_object_or_404(Brand, slug=slug)
    latest = brand.latest_published()
    return JsonResponse({
        "brand": brand.slug,
        "versions": [describe(s) for s in brand.token_sets.order_by("-version")],
        "layouts": latest.layouts if latest else {},
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
