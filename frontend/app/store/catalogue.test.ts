import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { fill, formatMoney, hrefFor, linePrice, priceBasket, reconcile, seedCart, type Catalogue } from "./catalogue";

const load = (brand: string): Catalogue =>
  JSON.parse(readFileSync(resolve(process.cwd(), `../catalogue/${brand}.catalogue.json`), "utf-8"));

describe("the sample baskets add up to the Figma totals", () => {
  it("Clementine: $35.86 less $2.16 of offers plus $3.99 delivery is $37.69, 14 items", () => {
    const catalogue = load("clementine");
    const totals = priceBasket(catalogue, seedCart(catalogue));
    const money = (cents: number) => formatMoney(cents, catalogue.currency);
    expect(money(totals.subtotal)).toBe("$35.86");
    expect(money(-totals.offers)).toBe("−$2.16");
    expect(money(totals.delivery)).toBe("$3.99");
    expect(money(totals.total)).toBe("$37.69");
    expect(totals.units).toBe(14);
    expect(totals.lines.map((line) => money(line.charged))).toEqual([
      "$2.00", "$2.98", "$9.98", "$7.98", "$4.49", "$2.29", "$3.98",
    ]);
  });

  it("Pomelo: $1,110 plus $60 of assembly with free delivery is $1,170, two lines", () => {
    const catalogue = load("pomelo");
    const totals = priceBasket(catalogue, seedCart(catalogue));
    const money = (cents: number) => formatMoney(cents, catalogue.currency);
    expect([money(totals.subtotal), money(totals.extras), totals.delivery, money(totals.total)]).toEqual([
      "$1,110", "$60", 0, "$1,170",
    ]);
    expect(totals.lines).toHaveLength(2);
  });
});

describe("offers", () => {
  const orange = { name: "Orange", price: 0.89, image: "/a.png", offer: { type: "multibuy" as const, quantity: 3, price: 2 } };
  const avocado = { name: "Avocado", price: 1.49, image: "/a.png", offer: { type: "free" as const, buy: 2, free: 1 } };

  it.each([
    [orange, 2, 178],
    [orange, 3, 200],
    [orange, 4, 289],
    [orange, 6, 400],
    [avocado, 2, 298],
    [avocado, 3, 298],
    [avocado, 6, 596],
  ])("%s.name × %i costs %i cents", (product, quantity, cents) => {
    expect(linePrice(product, quantity).charged).toBe(cents);
  });
});

describe("helpers", () => {
  it("charges no delivery or extras on an empty basket", () => {
    const totals = priceBasket(load("pomelo"), { lines: [], extras: ["assembly"], saved: [] });
    expect(totals.total).toBe(0);
  });

  it("drops products and extras a newer catalogue no longer has", () => {
    const catalogue = load("pomelo");
    const cart = reconcile(
      { lines: [{ product: "gone", quantity: 1 }, { product: "kestrel-stool", quantity: 2 }], extras: ["gone", "assembly"], saved: ["gone"] },
      catalogue,
    );
    expect(cart).toEqual({ lines: [{ product: "kestrel-stool", quantity: 2 }], extras: ["assembly"], saved: [] });
  });

  it("fills basket counts into layout copy and leaves unknown names alone", () => {
    expect(fill("Basket ({lines})", { lines: 2 })).toBe("Basket (2)");
    expect(fill("{units} items · {other}", { units: 14 })).toBe("14 items · {other}");
  });

  it("turns layout links into URLs", () => {
    expect(hrefFor("pomelo", "home")).toBe("/brands/pomelo");
    expect(hrefFor("pomelo", "basket")).toBe("/brands/pomelo/basket");
    expect(hrefFor("pomelo", "product/oda-side-chair")).toBe("/brands/pomelo/products/oda-side-chair");
    expect(hrefFor("pomelo", undefined)).toBeUndefined();
  });
});
