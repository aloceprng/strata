import { notFound } from "next/navigation";

import { BrandProvider, BrandStylesheet } from "../components/BrandProvider";
import { tokenVariable } from "../sections/Intro";
import { ScreenRenderer, type Screen } from "../sections/ScreenRenderer";
import type { Catalogue } from "../store/catalogue";
import { StoreProvider } from "../store/StoreProvider";

const ARTIFACT_STORE = process.env.NEXT_PUBLIC_ARTIFACT_STORE ?? "http://127.0.0.1:8000";

/** Server-side fetch of a published artifact. The browser's /artifacts rewrite does not apply here. */
async function loadArtifact<T>(brand: string, path: string): Promise<T | null> {
  const response = await fetch(`${ARTIFACT_STORE}/artifacts/${encodeURIComponent(brand)}/latest/${path}`, {
    cache: "no-store",
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`${brand}/${path} returned ${response.status}`);
  return response.json();
}

/**
 * One published screen of one brand. The product screen is a template: `product` names the
 * catalogue entry it shows, and an id the catalogue lacks is a 404.
 */
export async function BrandScreen({ brand, screen, product }: { brand: string; screen: string; product?: string }) {
  const [layout, catalogue] = await Promise.all([
    loadArtifact<Screen>(brand, `screens/${screen}.json`),
    loadArtifact<Catalogue>(brand, "catalogue.json"),
  ]);
  if (!layout) notFound();
  if (product !== undefined && !catalogue?.products[product]) notFound();

  return (
    <>
      <BrandStylesheet brand={brand} />
      <BrandProvider brand={brand}>
        <StoreProvider brand={brand} catalogue={catalogue ?? undefined} current={product ?? null}>
          <main
            className="strata-screen"
            data-fit={layout.fit ?? "scroll"}
            data-screen={screen}
            style={layout.gap ? { gap: tokenVariable(layout.gap) } : undefined}
          >
            <ScreenRenderer screen={layout} />
          </main>
        </StoreProvider>
      </BrandProvider>
    </>
  );
}
