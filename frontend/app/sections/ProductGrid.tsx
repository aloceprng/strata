"use client";

import { useState } from "react";

import { FilterChip, ProductCard, SectionHeader, ToolbarButton, useProductView } from "../components/commerce";
import { fill } from "../store/catalogue";
import { useStore } from "../store/StoreProvider";

export type ProductGridProps = {
  title: string;
  subtitle?: string;
  filters?: { label: string }[];
  sortLabel?: string;
  columns?: number;
  products: string[];
};

export function ProductGrid({ title, subtitle, filters = [], sortLabel, columns = 4, products }: ProductGridProps) {
  const store = useStore();
  const view = useProductView();
  const [filter, setFilter] = useState(filters[0]?.label ?? "");
  // first chip shows everything
  const shown = products.filter(
    (id) => filter === filters[0]?.label || (store?.product(id)?.filters ?? []).includes(filter),
  );
  const cards = shown.map(view).filter((card) => card !== null);

  return (
    <section className="strata-product-listing">
      <div className="strata-listing-header">
        <div className="strata-listing-top">
          <SectionHeader title={title} subtitle={subtitle ? fill(subtitle, { products: products.length }) : undefined} />
          <div className="strata-listing-toolbar">
            <ToolbarButton>Filters</ToolbarButton>
            {sortLabel ? <ToolbarButton icon="sort">{sortLabel}</ToolbarButton> : null}
          </div>
        </div>
        {filters.length ? (
          <div className="strata-filter-chips">
            {filters.map(({ label }) => (
              <FilterChip key={label} label={label} selected={label === filter} onClick={() => setFilter(label)} />
            ))}
          </div>
        ) : null}
      </div>
      <div className="strata-product-grid" data-size="large" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {cards.map((card) => (
          <ProductCard key={card.id} product={card} />
        ))}
      </div>
      {!cards.length ? <p className="strata-listing-empty">Nothing matches “{filter}” yet.</p> : null}
    </section>
  );
}
