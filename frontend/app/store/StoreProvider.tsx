"use client";

import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";

import { cartStore } from "./cartStore";

import {
  EMPTY_CATALOGUE,
  formatMoney,
  hrefFor,
  lineKey,
  priceBasket,
  type BasketTotals,
  type Cart,
  type Catalogue,
  type CatalogueProduct,
} from "./catalogue";

type Store = {
  brand: string;
  catalogue: Catalogue;
  /** The product a product screen is showing, if any. */
  current: string | null;
  cart: Cart;
  totals: BasketTotals;
  money: (cents: number) => string;
  href: (link: string | undefined) => string | undefined;
  product: (id: string) => CatalogueProduct | undefined;
  add: (product: string, quantity?: number, option?: string) => void;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  toggleExtra: (id: string) => void;
  toggleSaved: (product: string) => void;
};

const Context = createContext<Store | null>(null);

/** The store, or null outside a brand page (the token comparison renders cards on their own). */
export function useStore() {
  return useContext(Context);
}

export function StoreProvider({
  brand,
  catalogue = EMPTY_CATALOGUE,
  current = null,
  children,
}: {
  brand: string;
  catalogue?: Catalogue;
  current?: string | null;
  children: ReactNode;
}) {
  const store = useMemo(() => cartStore(brand, catalogue), [brand, catalogue]);
  const cart = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const actions = useMemo(() => cartActions(store.update), [store]);

  const value = useMemo<Store>(
    () => ({
      brand,
      catalogue,
      current,
      cart,
      totals: priceBasket(catalogue, cart),
      money: (amount) => formatMoney(amount, catalogue.currency),
      href: (link) => hrefFor(brand, link),
      product: (id) => catalogue.products[id],
      ...actions,
    }),
    [brand, catalogue, current, cart, actions],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

function cartActions(update: (change: (cart: Cart) => Cart) => void) {
  return {
    add(product: string, quantity = 1, option?: string) {
      update((c) => {
        const key = lineKey({ product, option });
        const existing = c.lines.find((line) => lineKey(line) === key);
        const lines = existing
          ? c.lines.map((line) => (line === existing ? { ...line, quantity: Math.min(line.quantity + quantity, 99) } : line))
          : [...c.lines, { product, quantity, ...(option ? { option } : {}) }];
        return { ...c, lines };
      });
    },
    setQuantity(key: string, quantity: number) {
      update((c) => ({
        ...c,
        lines: c.lines
          .map((line) => (lineKey(line) === key ? { ...line, quantity: Math.min(quantity, 99) } : line))
          .filter((line) => line.quantity > 0),
      }));
    },
    remove(key: string) {
      update((c) => ({ ...c, lines: c.lines.filter((line) => lineKey(line) !== key) }));
    },
    toggleExtra(id: string) {
      update((c) => ({ ...c, extras: toggle(c.extras, id) }));
    },
    toggleSaved(id: string) {
      update((c) => ({ ...c, saved: toggle(c.saved, id) }));
    },
  };
}
