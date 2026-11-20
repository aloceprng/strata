import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  addableTypes,
  humanize,
  inDraftOrder,
  issuesOf,
  knownAssets,
  linkableScreens,
  move,
  newSectionId,
  seedProps,
  tokenLabel,
} from "./editor";
import type { Reference } from "./model";

const contract = JSON.parse(readFileSync(resolve(process.cwd(), "../contracts/components.json"), "utf-8"));
const reference: Reference = { ...contract, fits: [], tokenOptions: {} };
const screen = (name: string, ...types: string[]) => ({
  schemaVersion: 1,
  screen: name,
  sections: types.map((type, i) => ({ id: `${type}-${i}`, type, props: { title: `${type} ${i}` } })),
});

describe("the contract", () => {
  it("gives every section type, prop and list item field a plain label", () => {
    const missing: string[] = [];
    const walk = (props: Record<string, { label?: string; type: string; items?: object }>, where: string) => {
      for (const [name, rule] of Object.entries(props)) {
        if (!rule.label) missing.push(`${where}.${name}`);
        if (rule.items) walk(rule.items as typeof props, `${where}.${name}`);
      }
    };
    for (const [type, section] of Object.entries<{ label?: string; props: never }>(contract.sections)) {
      if (!section.label) missing.push(type);
      walk(section.props, type);
    }
    expect(missing).toEqual([]);
  });
});

describe("names", () => {
  it("turns keys into words", () => {
    expect(humanize("logoAlt")).toBe("Logo alt");
    expect(tokenLabel("space.stack.gap-loose", "space.stack")).toBe("Gap loose");
  });
});

describe("addableTypes", () => {
  it("offers product-only sections on the product screen alone", () => {
    expect(addableTypes(reference, "home")).not.toContain("ProductOverview");
    expect(addableTypes(reference, "product")).toContain("ProductOverview");
  });

  it("offers only what the brand's tokens support", () => {
    expect(addableTypes({ ...reference, supported: ["Intro"] }, "home")).toEqual(["Intro"]);
  });
});

describe("links", () => {
  it("never name the product template screen", () => {
    expect(linkableScreens({ home: screen("home"), product: screen("product") })).toEqual(["home"]);
  });
});

describe("new sections", () => {
  it("get an id no section on the screen uses", () => {
    expect(newSectionId("SiteHeader", [{ id: "site-header", type: "SiteHeader" }, { id: "site-header-2", type: "x" }])).toBe("site-header-3");
  });

  it("copy the brand's own instance of the type", () => {
    const published = { home: screen("home", "Intro") };
    const props = seedProps("Intro", reference, published);
    expect(props).toEqual({ title: "Intro 0" });
    props.title = "changed";
    expect(published.home.sections[0].props.title).toBe("Intro 0");
  });

  it("otherwise get placeholders, with real products where some are required", () => {
    const catalogue = { schemaVersion: 1, currency: { code: "USD", decimals: 2 }, products: { a: { name: "A", price: 1, image: "/a.png" } } };
    expect(seedProps("ProductGrid", reference, {}, catalogue)).toEqual({ title: "Text", products: ["a"] });
  });
});

describe("issuesOf", () => {
  it("finds empty required text inside list rows", () => {
    const rules = reference.sections.SiteHeader.props;
    const issues = issuesOf({ variant: "full", links: [{ label: "Home" }, { label: " " }] }, rules);
    expect(issues).toEqual([{ path: ["Links", "2", "Label"], message: "can't be empty" }]);
  });

  it("flags a bad image path and a number out of range", () => {
    expect(issuesOf({ title: "t", columns: 9 }, reference.sections.ProductRow.props)[0].message).toMatch(/between 2 and 6/);
    expect(issuesOf({ headline: "h", image: "nope" }, reference.sections.PromoHero.props)[0].path).toEqual(["Image"]);
  });
});

describe("knownAssets", () => {
  it("collects every image path the brand uses, without placeholders", () => {
    const layouts = { home: { ...screen("home"), sections: [{ id: "a", type: "PromoHero", props: { image: "/brand/x/hero.png", alt: "x" } }, { id: "b", type: "PromoHero", props: { image: "/products/brand/name.png" } }] } };
    expect(knownAssets(layouts, { schemaVersion: 1, currency: { code: "USD", decimals: 2 }, products: { p: { name: "P", price: 1, image: "/products/x/p.png" } } })).toEqual(["/brand/x/hero.png", "/products/x/p.png"]);
  });
});

describe("move and inDraftOrder", () => {
  it("move ignores out-of-range targets", () => {
    const list = [1, 2, 3];
    expect(move(list, 0, -1)).toBe(list);
    expect(move(list, 2, 0)).toEqual([3, 1, 2]);
  });

  it("shows a pure reorder at once, but waits for the check on any other change", () => {
    const checked = screen("home", "Intro", "PageTitle");
    const reordered = { ...checked, sections: [checked.sections[1], checked.sections[0]] };
    expect(inDraftOrder(checked, reordered)?.sections[0].type).toBe("PageTitle");
    const edited = { ...reordered, sections: [{ ...reordered.sections[0], props: { title: "new" } }, reordered.sections[1]] };
    expect(inDraftOrder(checked, edited)).toBe(checked);
  });
});
