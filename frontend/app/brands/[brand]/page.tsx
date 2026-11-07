import { BrandScreen } from "../BrandScreen";

export default async function BrandHome({ params }: { params: Promise<{ brand: string }> }) {
  const { brand } = await params;
  return <BrandScreen brand={brand} screen="home" />;
}
