/**
 * The published catalogue and the maths of a basket. Pure functions only, so the
 * Figma totals can be checked in a unit test.
 */

export type TagTone = "deal" | "alert" | "info" | "inverse";
export type Label = { label: string; tone?: TagTone };

export type Offer =
  | { type: "multibuy"; quantity: number; price: number }
  | { type: "free"; buy: number; free: number };

export type CatalogueProduct = {
  name: string;
  price: number;
  image: string;
  category?: string;
  unit?: string;
  per?: string;
  unitPrice?: string;
  summary?: string;
  description?: string;
  material?: string;
  delivery?: string;
  tag?: Label;
  badges?: Label[];
  offer?: Offer;
  filters?: string[];
  details?: { title: string; body: string }[];
  specs?: { label: string; value: string }[];
  options?: { label: string; choices: { name: string; swatch: string }[] };
  related?: string[];
};

export type Extra = { id: string; label: string; note?: string; price: number; selected?: boolean };

export type Catalogue = {
  schemaVersion: number;
  currency: { code: string; decimals: number };
  delivery?: { fee: number };
  categories?: Record<string, { name: string }>;
  products: Record<string, CatalogueProduct>;
  extras?: Extra[];
  basket?: { product: string; quantity: number; option?: string }[];
  saved?: string[];
};

export type CartLine = { product: string; quantity: number; option?: string };
export type Cart = { lines: CartLine[]; extras: string[]; saved: string[] };

export const EMPTY_CATALOGUE: Catalogue = {
  schemaVersion: 1,
  currency: { code: "USD", decimals: 2 },
  products: {},
};

/** The starting basket, saved items and ticked extras a catalogue ships with. */
export function seedCart(catalogue: Catalogue): Cart {
  return {
    lines: (catalogue.basket ?? []).map((line) => ({ ...line })),
    extras: (catalogue.extras ?? []).filter((extra) => extra.selected).map((extra) => extra.id),
    saved: [...(catalogue.saved ?? [])],
  };
}

/** Drop anything a newer catalogue no longer sells, so a stale browser cart cannot break a page. */
export function reconcile(cart: Cart, catalogue: Catalogue): Cart {
  const extras = new Set((catalogue.extras ?? []).map((extra) => extra.id));
  return {
    lines: cart.lines.filter((line) => catalogue.products[line.product] && line.quantity > 0),
    extras: cart.extras.filter((id) => extras.has(id)),
    saved: cart.saved.filter((id) => catalogue.products[id]),
  };
}

export const lineKey = (line: { product: string; option?: string }) => `${line.product}|${line.option ?? ""}`;

const cents = (amount: number) => Math.round(amount * 100);

/** What a quantity of one product costs once its offer is applied, in cents. */
export function linePrice(product: CatalogueProduct, quantity: number) {
  const unit = cents(product.price);
  const full = unit * quantity;
  const offer = product.offer;
  let charged = full;
  if (offer?.type === "multibuy") {
    const groups = Math.floor(quantity / offer.quantity);
    charged = groups * cents(offer.price) + (quantity % offer.quantity) * unit;
  } else if (offer?.type === "free") {
    const groups = Math.floor(quantity / (offer.buy + offer.free));
    charged = (quantity - groups * offer.free) * unit;
  }
  return { full, charged, saving: full - charged };
}

export type PricedLine = CartLine & {
  key: string;
  item: CatalogueProduct;
  full: number;
  charged: number;
  saving: number;
};

export type BasketTotals = {
  lines: PricedLine[];
  units: number;
  subtotal: number;
  offers: number;
  extras: number;
  delivery: number;
  total: number;
};

export function priceBasket(catalogue: Catalogue, cart: Cart): BasketTotals {
  const lines = cart.lines.flatMap((line) => {
    const item = catalogue.products[line.product];
    return item ? [{ ...line, key: lineKey(line), item, ...linePrice(item, line.quantity) }] : [];
  });
  const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
  const subtotal = sum(lines.map((line) => line.full));
  const offers = sum(lines.map((line) => line.saving));
  const extras = sum(
    (catalogue.extras ?? []).filter((extra) => cart.extras.includes(extra.id)).map((extra) => cents(extra.price)),
  );
  const delivery = lines.length ? cents(catalogue.delivery?.fee ?? 0) : 0;
  return {
    lines,
    units: sum(lines.map((line) => line.quantity)),
    subtotal,
    offers,
    extras: lines.length ? extras : 0,
    delivery,
    total: subtotal - offers + (lines.length ? extras : 0) + delivery,
  };
}

/** Cents to "$1,110" or "$0.89", using the catalogue's decimals. A negative gets a true minus. */
export function formatMoney(amount: number, currency: Catalogue["currency"]) {
  const text = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.code,
    minimumFractionDigits: currency.decimals,
    maximumFractionDigits: currency.decimals,
  }).format(Math.abs(amount) / 100);
  return amount < 0 ? `−${text}` : text;
}

/** Fill {units}, {lines} and {products} in layout copy such as "Basket ({lines})". */
export function fill(template: string, values: Partial<Record<"units" | "lines" | "products", number>>) {
  return template.replace(/\{(units|lines|products)\}/g, (match, name: keyof typeof values) =>
    values[name] === undefined ? match : String(values[name]),
  );
}

/** A layout link is a screen name or product/<id>; the URL shape lives here alone. */
export function hrefFor(brand: string, link: string | undefined) {
  if (!link) return undefined;
  if (link.startsWith("product/")) return `/brands/${brand}/products/${link.slice("product/".length)}`;
  return link === "home" ? `/brands/${brand}` : `/brands/${brand}/${link}`;
}
