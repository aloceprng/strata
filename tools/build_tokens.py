#!/usr/bin/env python
"""
    python tools/build_tokens.py                 # every brand, to dist/
    python tools/build_tokens.py clementine      # one brand
    python tools/build_tokens.py --version v2    # write dist/<brand>/v2/ too
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from strata_core import (  # noqa: E402
    StrataError,
    emit_catalogue,
    emit_layout,
    load_contract,
    resolve_document,
    validate_catalogue,
    validate_layouts,
)
from strata_core.emitters import emit_css, emit_json  # noqa: E402
from strata_core.storage import LocalArtifactStore, versioned_path  # noqa: E402

TOKENS_DIR = ROOT / "tokens"
LAYOUTS_DIR = ROOT / "layouts"
CATALOGUE_DIR = ROOT / "catalogue"
CONTRACT = ROOT / "contracts" / "components.json"
DIST_DIR = ROOT / "dist"

def brands() -> list[str]:
    return sorted(p.name.removesuffix(".tokens.json") for p in TOKENS_DIR.glob("*.tokens.json"))

def read_optional(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}

def build_brand(brand: str, store: LocalArtifactStore, version: str | None) -> bool:
    source = TOKENS_DIR / f"{brand}.tokens.json"
    if not source.exists():
        print(f"  {brand}: no token file at {source.relative_to(ROOT)}")
        return False

    document = json.loads(source.read_text(encoding="utf-8"))
    layouts = read_optional(LAYOUTS_DIR / f"{brand}.layouts.json")
    catalogue = read_optional(CATALOGUE_DIR / f"{brand}.catalogue.json")

    started = time.perf_counter()
    try:
        resolved = resolve_document(document)
        validate_catalogue(catalogue)
        validate_layouts(layouts, load_contract(CONTRACT), resolved, catalogue)
    except StrataError as exc:
        print(f"  {brand}: FAILED — {exc}")
        return False
    elapsed_ms = (time.perf_counter() - started) * 1000

    outputs = {
        "theme.css": emit_css(resolved, brand),
        "tokens.json": emit_json(resolved, brand),
    }
    if catalogue:
        outputs["catalogue.json"] = emit_catalogue(catalogue)
    for screen, layout in layouts.items():
        outputs[f"screens/{screen}.json"] = emit_layout(layout)

    targets = ["latest"] + ([version] if version else [])
    written = []
    for target in targets:
        if target == "latest":
            store.clear(versioned_path(brand, target, "screens"))
        for filename, content in outputs.items():
            written.append(store.write(versioned_path(brand, target, filename), content))

    print(
        f"  {brand}: {len(resolved)} tokens, depth {resolved.max_chain_depth}, "
        f"resolved in {elapsed_ms:.1f}ms"
    )
    for artifact in written:
        print(f"      {artifact.path}  {artifact.size:>6}B  {artifact.checksum[:12]}")
    return True

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("brand", nargs="*", help="brand slug; omit for all")
    parser.add_argument("--version", help="also write an immutable versioned copy, e.g. v2")
    parser.add_argument("--out", default=str(DIST_DIR), help="artifact store root")
    args = parser.parse_args()

    selected = args.brand or brands()
    if not selected:
        print(f"No token files found in {TOKENS_DIR}")
        return 1

    out = Path(args.out).resolve()
    store = LocalArtifactStore(out)
    shown = out.relative_to(ROOT) if out.is_relative_to(ROOT) else out
    print(f"Building {len(selected)} brand(s) into {shown.as_posix()}/")

    ok = all([build_brand(brand, store, args.version) for brand in selected])
    return 0 if ok else 1

if __name__ == "__main__":
    raise SystemExit(main())
