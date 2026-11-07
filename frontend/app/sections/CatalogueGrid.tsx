"use client";

import { useState } from "react";

import { CatalogueCard } from "../components/commerce";
import { fill } from "../store/catalogue";

export type CatalogueGridProps = {
  title: string;
  count?: string;
  filters?: { label: string }[];
  sortLabel?: string;
  products: string[];
};

/** Pomelo's listing: a display title, quiet text tabs, and a hairline grid of pieces. */
export function CatalogueGrid({ title, count, filters = [], sortLabel, products }: CatalogueGridProps) {
  const [filter, setFilter] = useState(filters[0]?.label ?? "");
  return (
    <section className="strata-catalogue">
      <div className="strata-catalogue-header">
        <h1 className="strata-display-title">
          {title}
          {count ? <span className="strata-display-count">{fill(count, { products: products.length })}</span> : null}
        </h1>
        <div className="strata-catalogue-tools">
          {filters.map(({ label }) => (
            <button
              key={label}
              type="button"
              className="strata-text-tab"
              aria-pressed={label === filter}
              onClick={() => setFilter(label)}
            >
              {label}
            </button>
          ))}
          {sortLabel ? (
            <>
              <span className="strata-catalogue-divider" aria-hidden="true" />
              <button type="button" className="strata-text-tab" data-strong>
                {sortLabel}
              </button>
            </>
          ) : null}
        </div>
      </div>
      <div className="strata-catalogue-grid">
        {products.map((id) => (
          <CatalogueCard key={id} id={id} />
        ))}
      </div>
    </section>
  );
}
