import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { cleanup, fireEvent, render, screen as view } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { tokenVariable } from "./Intro";
import { resetCarts } from "../store/cartStore";
import type { Catalogue } from "../store/catalogue";
import { StoreProvider } from "../store/StoreProvider";
import { ScreenRenderer, SECTIONS, type Screen } from "./ScreenRenderer";

const contract = JSON.parse(
  readFileSync(resolve(process.cwd(), "../contracts/components.json"), "utf-8"),
);

function screenOf(...sections: Screen["sections"]): Screen {
  return { schemaVersion: 1, screen: "home", sections };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("the component contract", () => {
  it("has a renderer for every section and a section for every renderer", () => {
    expect(Object.keys(SECTIONS).sort()).toEqual(Object.keys(contract.sections).sort());
  });
});

type Layouts = Record<string, Screen>;
const readJson = (path: string) => JSON.parse(readFileSync(resolve(process.cwd(), path), "utf-8"));
const layouts = (brand: string): Layouts => readJson(`../layouts/${brand}.layouts.json`);
const catalogue = (brand: string): Catalogue => readJson(`../catalogue/${brand}.catalogue.json`);

function renderScreen(brand: string, name: string, product?: string) {
  return render(
    <StoreProvider brand={brand} catalogue={catalogue(brand)} current={product}>
      <ScreenRenderer screen={layouts(brand)[name]} />
    </StoreProvider>,
  );
}

describe("the published screens", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetCarts();
  });

  it.each([
    ["clementine", "home", undefined], ["clementine", "shop", undefined], ["clementine", "product", "navel-oranges"], ["clementine", "basket", undefined],
    ["pomelo", "home", undefined], ["pomelo", "shop", undefined], ["pomelo", "product", "dylan-swivel-chair"], ["pomelo", "basket", undefined],
  ])("renders %s's %s screen without skipping a section", (brand, name, product) => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const { container } = renderScreen(brand, name, product);
    expect(logged).not.toHaveBeenCalled();
    expect(container.textContent).not.toBe("");
  });

  it("gives Clementine a dense home of add-to-basket cards", () => {
    renderScreen("clementine", "home");
    expect(view.getByRole("searchbox")).toBeTruthy();
    expect(view.getAllByRole("article")).toHaveLength(5);
    expect(view.getByText("Shop by aisle")).toBeTruthy();
    expect(view.getByRole("link", { name: "Basket, 14 items, $37.69" })).toBeTruthy();
  });

  it("gives Pomelo a different structure from the same atoms", () => {
    renderScreen("pomelo", "home");
    expect(view.queryByRole("searchbox")).toBeNull();
    expect(view.queryByRole("article")).toBeNull();
    expect(view.getByRole("link", { name: "Basket (2)" }).getAttribute("aria-current")).toBe("page");
    expect(view.getAllByRole("img", { name: "Pomelo" })).toHaveLength(2);
    expect(view.getByRole("contentinfo")).toBeTruthy();
  });

  it("shares saved state between cards and starts from the catalogue", () => {
    renderScreen("clementine", "shop");
    expect(view.getByRole("button", { name: "Remove Baby spinach from saved" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(view.getByRole("button", { name: "Save Vine tomatoes" }));
    expect(view.getByRole("button", { name: "Remove Vine tomatoes from saved" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("filters the Clementine listing by chip", () => {
    renderScreen("clementine", "shop");
    expect(view.getAllByRole("article")).toHaveLength(12);
    fireEvent.click(view.getByRole("button", { name: "Organic" }));
    expect(view.getAllByRole("article").map((a) => a.querySelector("h3")?.textContent)).toEqual([
      "Baby spinach", "Spring mix salad",
    ]);
  });

  it("adds from a card and the header total follows", () => {
    renderScreen("clementine", "home");
    fireEvent.click(view.getByRole("button", { name: "Add Lemons to basket" }));
    expect(view.getByRole("link", { name: "Basket, 15 items, $38.38" })).toBeTruthy();
  });

  it("adds a chosen quantity from the product page at the offer price", () => {
    renderScreen("clementine", "product", "navel-oranges");
    expect(view.getByRole("heading", { level: 1, name: "Navel oranges" })).toBeTruthy();
    fireEvent.click(view.getByRole("button", { name: "Increase" }));
    fireEvent.click(view.getByRole("button", { name: "Increase" }));
    fireEvent.click(view.getByRole("button", { name: "Add to basket · $2.00" }));
    expect(view.getByRole("link", { name: /Basket, 17 items/ })).toBeTruthy();
    expect(view.getByRole("navigation", { name: "Breadcrumb" }).textContent).toBe("ShopFruit & vegNavel oranges");
  });

  it("changes, removes and re-totals Clementine basket lines", () => {
    renderScreen("clementine", "basket");
    expect(view.getByText("14 items")).toBeTruthy();
    const oranges = view.getByRole("group", { name: "Quantity of Navel oranges" });
    fireEvent.click(oranges.querySelector('[aria-label="Decrease"]')!);
    expect(view.getByText("13 items")).toBeTruthy();
    fireEvent.click(view.getByRole("button", { name: "Remove Mango, ready to eat" }));
    expect(view.getByText("11 items")).toBeTruthy();
    expect(view.getByText("You’re saving $1.49 on this order")).toBeTruthy();
  });

  it("adds Pomelo's chosen colour and lets extras change the total", () => {
    renderScreen("pomelo", "basket");
    expect(view.getByText("$1,170")).toBeTruthy();
    fireEvent.click(view.getByRole("checkbox", { name: /Fabric protection/ }));
    expect(view.getByText("$1,215")).toBeTruthy();
    fireEvent.click(view.getByRole("button", { name: /Remove Dylan swivel chair/ }));
    expect(view.getByText("(1)")).toBeTruthy();
  });

  it("explains rather than checks out", () => {
    renderScreen("pomelo", "basket");
    fireEvent.click(view.getByRole("button", { name: "Checkout" }));
    expect(view.getByText(/isn’t part of this demo/)).toBeTruthy();
  });

  it("empties to a link back to the shop", () => {
    renderScreen("pomelo", "basket");
    fireEvent.click(view.getByRole("button", { name: /Remove Dylan swivel chair/ }));
    fireEvent.click(view.getByRole("button", { name: /Remove Holm dining chair/ }));
    expect(view.getByText("Nothing in your basket yet.")).toBeTruthy();
    expect(view.getByRole("link", { name: "Shop the collection" }).getAttribute("href")).toBe("/brands/pomelo/shop");
  });

  it("keeps the basket in the browser between pages", () => {
    const first = renderScreen("pomelo", "product", "dylan-swivel-chair");
    fireEvent.click(view.getByRole("radio", { name: "Corduroy — Navy" }));
    fireEvent.click(view.getByRole("button", { name: "Add to basket" }));
    first.unmount();
    renderScreen("pomelo", "basket");
    expect(view.getByText("Corduroy — Navy")).toBeTruthy();
    expect(view.getByText("(3)")).toBeTruthy();
  });
});

describe("ScreenRenderer", () => {
  it("renders sections in the published order", () => {
    render(
      <ScreenRenderer
        screen={screenOf(
          { id: "b", type: "Intro", props: { title: "Second" } },
          { id: "a", type: "Intro", props: { title: "First" } },
        )}
      />,
    );
    expect(view.getAllByRole("heading").map((h) => h.textContent)).toEqual(["Second", "First"]);
  });

  it("skips and logs a section it does not know", () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ScreenRenderer
        screen={screenOf(
          { id: "x", type: "FromTheFuture" },
          { id: "a", type: "Intro", props: { title: "Still here" } },
        )}
      />,
    );
    expect(view.getByRole("heading").textContent).toBe("Still here");
    expect(logged).toHaveBeenCalledWith(expect.stringContaining("FromTheFuture"));
  });

  it("renders an empty screen", () => {
    const { container } = render(<ScreenRenderer screen={screenOf()} />);
    expect(container.textContent).toBe("");
  });
});

describe("Intro", () => {
  it("omits the body when there is none", () => {
    render(<ScreenRenderer screen={screenOf({ id: "a", type: "Intro", props: { title: "T" } })} />);
    expect(view.queryByRole("paragraph")).toBeNull();
  });

  it("applies its tone and gap", () => {
    render(
      <ScreenRenderer
        screen={screenOf({
          id: "a",
          type: "Intro",
          props: { title: "T", body: "B", tone: "accent", gap: "space.stack.gap" },
        })}
      />,
    );
    expect(view.getByText("B").dataset.tone).toBe("accent");
    expect(view.getByText("B").parentElement?.style.gap).toBe("var(--space-stack-gap)");
  });

  it("turns a token name into its CSS variable", () => {
    expect(tokenVariable("space.stack.gap-loose")).toBe("var(--space-stack-gap-loose)");
  });
});
