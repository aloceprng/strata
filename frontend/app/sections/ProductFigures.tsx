"use client";

import { ProductFigure, useProductView } from "../components/commerce";

export type ProductFiguresProps = {
  align?: "start" | "end";
  products: string[];
};

export function ProductFigures({ align = "start", products }: ProductFiguresProps) {
  const view = useProductView();
  return (
    <section className="strata-product-figures" data-align={align}>
      {products.map(view).map((product) =>
        product ? <ProductFigure key={product.id} product={product} /> : null,
      )}
    </section>
  );
}
