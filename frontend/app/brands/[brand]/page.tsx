import { notFound } from "next/navigation";

import { BrandProvider, BrandStylesheet } from "../../components/BrandProvider";
import { ScreenRenderer, type Screen } from "../../sections/ScreenRenderer";

const ARTIFACT_STORE =
  process.env.NEXT_PUBLIC_ARTIFACT_STORE ?? "http://127.0.0.1:8000";

async function loadScreen(brand: string, screen: string): Promise<Screen | null> {
  const slug = encodeURIComponent(brand);
  const response = await fetch(`${ARTIFACT_STORE}/artifacts/${slug}/latest/screens/${screen}.json`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`${brand}/${screen} returned ${response.status}`);
  return response.json();
}

export default async function BrandHome({
  params,
}: {
  params: Promise<{ brand: string }>;
}) {
  const { brand } = await params;
  const screen = await loadScreen(brand, "home");
  if (!screen) notFound();

  return (
    <>
      <BrandStylesheet brand={brand} />
      <BrandProvider brand={brand}>
        <main className="strata-screen">
          <ScreenRenderer screen={screen} />
        </main>
      </BrandProvider>
    </>
  );
}
