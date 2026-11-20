"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import { BrandProvider, BrandStylesheet, type Bundle, type TokenEntry } from "../components/BrandProvider";
import { StrataLogo } from "../components/StrataLogo";
import {
  Avatar,
  BasketButton,
  CategoryTile,
  NavLink,
  OfferTag,
  Price,
  ProductCard,
  ProductFigure,
  SearchField,
  SectionHeader,
} from "../components/commerce";
import { Button } from "../components/primitives";
import type { Screen } from "../sections/ScreenRenderer";
import styles from "./compare.module.css";

const BRANDS = ["clementine", "pomelo"];

type Loaded = { bundle: Bundle | null; screen: Screen | null };

function useBrandData(brand: string): Loaded {
  const [data, setData] = useState<Loaded & { brand: string }>({ brand: "", bundle: null, screen: null });
  useEffect(() => {
    let cancelled = false;
    const get = (path: string) =>
      fetch(`/artifacts/${brand}/latest/${path}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    Promise.all([get("tokens.json"), get("screens/home.json")]).then(([bundle, screen]) => {
      if (!cancelled) setData({ brand, bundle, screen });
    });
    return () => {
      cancelled = true;
    };
  }, [brand]);
  return data.brand === brand ? data : { bundle: null, screen: null };
}

const SAMPLE_PRODUCT = {
  name: "Vine tomatoes",
  price: "$1.85",
  unit: "/400g",
  image: "/products/clementine/vine-tomato.png",
  tag: "20% off",
  tagTone: "deal" as const,
};

const ROWS: { name: string; reads: string[]; render: () => ReactNode; width?: number }[] = [
  {
    name: "Button",
    reads: ["colour.action.*", "colour.secondary.*", "radius.control", "size.control", "font.control.weight"],
    render: () => (
      <div className={styles.inline}>
        <Button variant="primary">Shop the offer</Button>
        <Button variant="secondary">Book a visit</Button>
      </div>
    ),
  },
  {
    name: "Nav Link",
    reads: ["colour.text.nav", "font.label.weight", "font.label-strong.weight"],
    render: () => (
      <div className={styles.inline}>
        <NavLink label="Home" active />
        <NavLink label="Shop" />
        <NavLink label="Offers" />
      </div>
    ),
  },
  {
    name: "Offer Tag",
    reads: ["colour.tag.*", "colour.status.danger", "radius.pill"],
    render: () => (
      <div className={styles.inline}>
        <OfferTag tone="deal">20% off</OfferTag>
        <OfferTag tone="alert">Last few</OfferTag>
        <OfferTag tone="info">New</OfferTag>
        <OfferTag tone="inverse">This week only</OfferTag>
      </div>
    ),
  },
  {
    name: "Price",
    reads: ["font.price.size", "font.price.weight", "font.price.leading", "font.price.tracking", "colour.text.price"],
    render: () => <Price amount="$1,480" unit="each" />,
  },
  {
    name: "Product Card",
    reads: ["space.card.padding", "space.card.gap", "radius.card", "elevation.card", "font.name.weight"],
    render: () => <ProductCard product={SAMPLE_PRODUCT} />,
    width: 240,
  },
  {
    name: "Product Figure",
    reads: ["font.name.weight", "font.price.*", "colour.text.price"],
    render: () => <ProductFigure product={{ name: "Alder three-seat", price: "$1,480", image: "/products/pomelo/sofa.png" }} />,
    width: 204,
  },
  {
    name: "Category Tile",
    reads: ["colour.surface.page", "radius.card", "font.label-strong.weight"],
    render: () => <CategoryTile category={{ name: "Fruit & veg", count: "342 items", image: "/categories/clementine/fruit-veg.png" }} />,
  },
  {
    name: "Search Field",
    reads: ["colour.surface.sunken", "radius.control", "size.control", "space.control.padding-x"],
    render: () => <SearchField placeholder="Search" />,
    width: 280,
  },
  {
    name: "Basket Button · Avatar",
    reads: ["colour.action.*", "size.control", "font.label-strong.weight"],
    render: () => (
      <div className={styles.inline}>
        <BasketButton total="$38.20" count={14} />
        <Avatar initials="SC" />
      </div>
    ),
  },
  {
    name: "Section Header",
    reads: ["font.heading.family", "font.heading.weight", "colour.text.accent"],
    render: () => <SectionHeader title="Deals this week" subtitle="Ends Sunday" linkLabel="See all →" />,
  },
];

const display = (v: TokenEntry["value"] | undefined) => (v === undefined ? "—" : Array.isArray(v) ? v.join(", ") : String(v));
const isColour = (e?: TokenEntry) => e?.type === "color";

export default function Compare() {
  const [left, setLeft] = useState("clementine");
  const [right, setRight] = useState("pomelo");
  const [showAll, setShowAll] = useState(false);
  const a = useBrandData(left);
  const b = useBrandData(right);

  const tokenRows = useMemo(() => {
    if (!a.bundle || !b.bundle) return null;
    const paths = new Set(
      [...Object.keys(a.bundle.tokens), ...Object.keys(b.bundle.tokens)].filter((p) => p.startsWith("semantic.") || p.startsWith("component.")),
    );
    return [...paths]
      .sort((x, y) => x.localeCompare(y, undefined, { numeric: true }))
      .map((path) => {
        const l = a.bundle!.tokens[path];
        const r = b.bundle!.tokens[path];
        return { path, l, r, differs: display(l?.value) !== display(r?.value) };
      });
  }, [a.bundle, b.bundle]);

  const differing = tokenRows?.filter((t) => t.differs) ?? [];
  const shown = showAll ? tokenRows ?? [] : differing;

  return (
    <>
      {BRANDS.map((brand) => (
        <BrandStylesheet key={brand} brand={brand} />
      ))}
      <div className={styles.page}>
        <header className={styles.masthead}>
          <div>
            <p className={`${styles.eyebrow} ${styles.eyebrowRow}`}><StrataLogo height={10} /> · compare</p>
            <h1 className={styles.title}>
              <BrandPicker value={left} onChange={setLeft} label="Left brand" />
              <span className={styles.vs}>vs</span>
              <BrandPicker value={right} onChange={setRight} label="Right brand" />
            </h1>
          </div>
          <p className={styles.lead}>
            One set of components and one renderer. Everything that differs below comes from each brand&apos;s tokens and published layout, not from code.
          </p>
        </header>

        <section className={styles.section}>
          <h2>Same components, two brands</h2>
          <p className={styles.sectionLead}>Identical props on both sides. The tokens listed are the ones that make them look different.</p>
          <div className={styles.columnsHead}>
            <span />
            <span>{left}</span>
            <span>{right}</span>
          </div>
          {ROWS.map((row) => (
            <div key={row.name} className={styles.row}>
              <div className={styles.rowHead}>
                <h3>{row.name}</h3>
                <div className={styles.tags}>
                  {row.reads.map((t) => (
                    <code key={t}>{t}</code>
                  ))}
                </div>
              </div>
              {[left, right].map((brand) => (
                <BrandProvider key={brand} brand={brand}>
                  <div className={styles.stage}>
                    <div style={row.width ? { width: row.width } : undefined}>{row.render()}</div>
                  </div>
                </BrandProvider>
              ))}
            </div>
          ))}
        </section>

        <section className={styles.section}>
          <div className={styles.sectionTop}>
            <div>
              <h2>Tokens that differ</h2>
              <p className={styles.sectionLead}>
                {tokenRows
                  ? `${differing.length} of ${tokenRows.length} semantic tokens and component defaults resolve to different values.`
                  : "Loading tokens…"}
              </p>
            </div>
            <label className={styles.toggle}>
              <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
              show all
            </label>
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>token</th>
                <th>{left}</th>
                <th>{right}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(({ path, l, r, differs }) => (
                <tr key={path} data-same={differs ? undefined : true}>
                  <td>
                    <code>{path.replace(/^semantic\./, "")}</code>
                  </td>
                  <TokenCell entry={l} />
                  <TokenCell entry={r} />
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className={styles.section}>
          <h2>Page structure</h2>
          <p className={styles.sectionLead}>Each brand&apos;s published home screen, in the order the server sends it.</p>
          <div className={styles.structure}>
            {[
              { brand: left, screen: a.screen },
              { brand: right, screen: b.screen },
            ].map(({ brand, screen }) => (
              <div key={brand} className={styles.structureCol}>
                <div className={styles.structureHead}>
                  <strong>{brand}</strong>
                  {screen ? <span className={styles.badge}>fit: {screen.fit ?? "scroll"}</span> : null}
                </div>
                {screen ? (
                  <ol className={styles.sections}>
                    {screen.sections.map((s) => (
                      <li key={s.id}>
                        <span className={styles.sectionType}>{s.type}</span>
                        <span className={styles.sectionMeta}>{describe(s.props)}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className={styles.sectionLead}>No published home screen.</p>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

function BrandPicker({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <select className={styles.picker} value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      {BRANDS.map((brand) => (
        <option key={brand} value={brand}>
          {brand}
        </option>
      ))}
    </select>
  );
}

function TokenCell({ entry }: { entry?: TokenEntry }) {
  return (
    <td>
      <span className={styles.value}>
        {isColour(entry) ? <span className={styles.swatch} style={{ background: display(entry?.value) }} /> : null}
        <code>{display(entry?.value)}</code>
        {entry?.aliasedFrom ? <code className={styles.alias}>← {entry.aliasedFrom.split(".").slice(1).join(".")}</code> : null}
      </span>
    </td>
  );
}

function describe(props: Record<string, unknown> = {}): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(props)) {
    if (["variant", "align", "columns"].includes(key)) parts.push(`${key}: ${value}`);
    else if (Array.isArray(value)) parts.push(`${value.length} ${key}`);
  }
  return parts.join(" · ");
}
