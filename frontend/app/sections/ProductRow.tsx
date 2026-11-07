"use client";

import { ProductCard, SectionHeader, useProductView } from "../components/commerce";
import { useStore } from "../store/StoreProvider";

export type ProductRowProps = {
  title: string;
  subtitle?: string;
  linkLabel?: string;
  link?: string;
  columns?: number;
  source?: "list" | "related";
  products?: string[];
};

export function ProductRow({ title, subtitle, linkLabel, link, columns = 5, source = "list", products = [] }: ProductRowProps) {
  const store = useStore();
  const view = useProductView();
  const current = store?.current ? store.product(store.current) : undefined;
  const ids = source === "related" ? (current?.related ?? []) : products;
  const cards = ids.map(view).filter((card) => card !== null).slice(0, columns);
  if (!cards.length) return null;

  return (
    <section className="strata-product-row">
      <SectionHeader title={title} subtitle={subtitle} linkLabel={linkLabel} link={link} />
      <div className="strata-product-grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {cards.map((card) => (
          <ProductCard key={card.id} product={card} />
        ))}
      </div>
    </section>
  );
}
