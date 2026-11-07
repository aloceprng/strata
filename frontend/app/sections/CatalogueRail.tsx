"use client";

import { useRef } from "react";

import { CatalogueCard, ChevronButton } from "../components/commerce";
import { useStore } from "../store/StoreProvider";

export type CatalogueRailProps = {
  title: string;
  source?: "list" | "related";
  products?: string[];
};

export function CatalogueRail({ title, source = "list", products = [] }: CatalogueRailProps) {
  const store = useStore();
  const track = useRef<HTMLDivElement>(null);
  const current = store?.current ? store.product(store.current) : undefined;
  const ids = (source === "related" ? (current?.related ?? []) : products).filter((id) => store?.product(id));
  if (!ids.length) return null;

  const scroll = (direction: 1 | -1) =>
    track.current?.scrollBy({ left: direction * track.current.clientWidth * 0.75, behavior: "smooth" });

  return (
    <section className="strata-catalogue-rail">
      <div className="strata-rail-heading">
        <h2 className="strata-section-title">{title}</h2>
        <div className="strata-rail-arrows">
          <ChevronButton direction="previous" onClick={() => scroll(-1)} />
          <ChevronButton direction="next" onClick={() => scroll(1)} />
        </div>
      </div>
      <div className="strata-rail-track" ref={track}>
        {ids.map((id) => (
          <CatalogueCard key={id} id={id} />
        ))}
      </div>
    </section>
  );
}
