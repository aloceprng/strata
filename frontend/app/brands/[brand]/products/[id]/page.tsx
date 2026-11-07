import { BrandScreen } from "../../../BrandScreen";

export default async function ProductPage({ params }: { params: Promise<{ brand: string; id: string }> }) {
  const { brand, id } = await params;
  return <BrandScreen brand={brand} screen="product" product={id} />;
}
