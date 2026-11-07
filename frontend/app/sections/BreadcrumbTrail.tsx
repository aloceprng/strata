"use client";

import { Breadcrumb, type Crumb } from "../components/commerce";
import { useStore } from "../store/StoreProvider";

export type BreadcrumbTrailProps = {
  items?: Crumb[];
  withProduct?: boolean;
};

export function BreadcrumbTrail({ items = [], withProduct }: BreadcrumbTrailProps) {
  const store = useStore();
  const product = withProduct && store?.current ? store.product(store.current) : undefined;
  const category = product?.category ? store?.catalogue.categories?.[product.category] : undefined;
  const trail = [
    ...items,
    ...(category ? [{ label: category.name, link: "shop" }] : []),
    ...(product ? [{ label: product.name }] : []),
  ];
  return trail.length ? <Breadcrumb items={trail} /> : null;
}
