import { notFound } from "next/navigation";

import { BrandScreen } from "../../BrandScreen";

// home and product have their own routes
const ROUTED_ELSEWHERE = new Set(["home", "product"]);

export default async function BrandPage({ params }: { params: Promise<{ brand: string; screen: string }> }) {
  const { brand, screen } = await params;
  if (ROUTED_ELSEWHERE.has(screen) || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(screen)) notFound();
  return <BrandScreen brand={brand} screen={screen} />;
}
