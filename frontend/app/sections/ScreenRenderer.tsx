import type { ComponentType } from "react";

import { Basket } from "./Basket";
import { BreadcrumbTrail } from "./BreadcrumbTrail";
import { CatalogueGrid } from "./CatalogueGrid";
import { CatalogueRail } from "./CatalogueRail";
import { CategoryCarousel } from "./CategoryCarousel";
import { Intro } from "./Intro";
import { PageTitle } from "./PageTitle";
import { ProductFigures } from "./ProductFigures";
import { ProductGrid } from "./ProductGrid";
import { ProductOverview } from "./ProductOverview";
import { ProductRow } from "./ProductRow";
import { ProductShowcase } from "./ProductShowcase";
import { PromoHero } from "./PromoHero";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";
import { WordmarkHero } from "./WordmarkHero";

export type Section = {
  id: string;
  type: string;
  props?: Record<string, unknown>;
};

export type Screen = {
  schemaVersion: number;
  screen: string;
  fit?: "scroll" | "viewport";
  gap?: string;
  sections: Section[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const SECTIONS: Record<string, ComponentType<any>> = {
  Intro,
  SiteHeader,
  PromoHero,
  ProductRow,
  CategoryCarousel,
  ProductGrid,
  CatalogueGrid,
  Breadcrumb: BreadcrumbTrail,
  ProductOverview,
  ProductShowcase,
  CatalogueRail,
  PageTitle,
  Basket,
  SiteFooter,
  ProductFigures,
  WordmarkHero,
};

export function ScreenRenderer({ screen }: { screen: Screen }) {
  return screen.sections.map((section) => {
    const Component = SECTIONS[section.type];
    if (!Component) {
      console.error(`[strata] ${screen.screen}: skipped unknown section ${section.type}`);
      return null;
    }
    return <Component key={section.id} {...section.props} />;
  });
}
