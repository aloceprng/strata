"use client";

import Link from "next/link";
import { useId, useState, type ComponentPropsWithoutRef, type ReactNode } from "react";

import type { CatalogueProduct, TagTone } from "../store/catalogue";
import { useStore } from "../store/StoreProvider";
import { Button, IconButton } from "./primitives";

export type { TagTone };

export type IconName =
  | "search"
  | "heart"
  | "heart-filled"
  | "plus"
  | "minus"
  | "close"
  | "clock"
  | "check"
  | "sort"
  | "chevron-left"
  | "chevron-right";

const HEART =
  "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z";

// figma 20px glyphs scaled into the 24px box
const onTwenty = (glyph: ReactNode) => (
  <g transform="scale(1.2)" strokeWidth={5 / 3}>
    {glyph}
  </g>
);

const GLYPHS: Record<IconName, ReactNode> = {
  search: (
    <>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  heart: <path d={HEART} />,
  "heart-filled": <path d={HEART} fill="currentColor" />,
  plus: <path d="M5 12h14M12 5v14" />,
  minus: onTwenty(<path d="M4.1667 10H15.8334" />),
  close: onTwenty(<path d="M5 5L10 10M10 10L15 15M10 10L15 5M10 10L5 15" />),
  clock: onTwenty(
    <>
      <circle cx="10" cy="10" r="6.66667" />
      <path d="M10 5.5V10L13 12" />
    </>,
  ),
  check: onTwenty(<path d="M4 10.5L8 14.5L16 5.5" />),
  sort: onTwenty(<path d="M6 3V17M9.5 6.5L6 3L2.5 6.5M14 17V3M17.5 13.5L14 17L10.5 13.5" />),
  "chevron-left": <path d="m15 18-6-6 6-6" />,
  "chevron-right": <path d="m9 18 6-6-6-6" />,
};

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="strata-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {GLYPHS[name]}
    </svg>
  );
}

export function LinkTo({
  link,
  children,
  ...rest
}: { link?: string; children: ReactNode } & Omit<ComponentPropsWithoutRef<"a">, "href">) {
  const store = useStore();
  const href = store?.href(link);
  return href ? (
    <Link href={href} {...rest}>
      {children}
    </Link>
  ) : (
    <a {...rest}>{children}</a>
  );
}

export function NavLink({ label, link, active }: { label: string; link?: string; active?: boolean }) {
  return (
    <LinkTo
      className="strata-nav-link"
      link={link}
      data-active={active || undefined}
      aria-current={active ? "page" : undefined}
    >
      {label}
    </LinkTo>
  );
}

export function OfferTag({ tone = "deal", children }: { tone?: TagTone; children: ReactNode }) {
  return (
    <span className="strata-offer-tag" data-tone={tone}>
      {children}
    </span>
  );
}

export function SaveButton({ product, saved: initial = false, label }: { product?: string; saved?: boolean; label: string }) {
  const store = useStore();
  const [local, setLocal] = useState(initial);
  const shared = store && product ? store.cart.saved.includes(product) : null;
  const saved = shared ?? local;
  const toggle = () => (store && product ? store.toggleSaved(product) : setLocal((s) => !s));
  return (
    <button
      type="button"
      className="strata-save-button"
      data-saved={saved || undefined}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${label} from saved` : `Save ${label}`}
      onClick={toggle}
    >
      <Icon name={saved ? "heart-filled" : "heart"} />
    </button>
  );
}

export function AddButton({ product, label }: { product?: string; label: string }) {
  const store = useStore();
  return (
    <button
      type="button"
      className="strata-add-button"
      aria-label={`Add ${label} to basket`}
      onClick={() => (store && product ? store.add(product) : undefined)}
    >
      <Icon name="plus" />
    </button>
  );
}

export function SearchField({ placeholder }: { placeholder: string }) {
  return (
    <label className="strata-search-field">
      <Icon name="search" />
      <input type="search" placeholder={placeholder} aria-label={placeholder} />
    </label>
  );
}

export function Avatar({ initials }: { initials: string }) {
  return (
    <span className="strata-avatar" role="img" aria-label="Your account">
      {initials}
    </span>
  );
}

export function BasketButton({ total, count }: { total?: string; count?: number }) {
  const store = useStore();
  const shownTotal = store ? store.money(store.totals.total) : (total ?? "");
  const shownCount = store ? store.totals.units : (count ?? 0);
  return (
    <LinkTo className="strata-basket-button" link={store ? "basket" : undefined} aria-label={`Basket, ${shownCount} items, ${shownTotal}`}>
      <span className="strata-basket-total">{shownTotal}</span>
      <span className="strata-basket-count">{shownCount}</span>
    </LinkTo>
  );
}

export function Price({ amount, unit }: { amount: string; unit?: string }) {
  return (
    <span className="strata-price">
      <span className="strata-price-amount">{amount}</span>
      {unit ? <span className="strata-price-unit">{unit}</span> : null}
    </span>
  );
}

export type Product = {
  id?: string;
  name: string;
  price: string;
  unit?: string;
  image: string;
  tag?: string;
  tagTone?: TagTone;
  saved?: boolean;
};

export function useProductView() {
  const store = useStore();
  return (id: string): Product | null => {
    const item = store?.product(id);
    if (!store || !item) return null;
    return {
      id,
      name: item.name,
      price: store.money(Math.round(item.price * 100)),
      unit: item.unit,
      image: item.image,
      tag: item.tag?.label,
      tagTone: item.tag?.tone,
    };
  };
}

export function ProductCard({ product }: { product: Product }) {
  const link = product.id ? `product/${product.id}` : undefined;
  return (
    <article className="strata-product-card">
      <div className="strata-product-card-image">
        <LinkTo link={link} tabIndex={-1} aria-hidden="true">
          <img src={product.image} alt="" />
        </LinkTo>
        <SaveButton product={product.id} saved={product.saved} label={product.name} />
      </div>
      <div className="strata-product-card-info">
        <div className="strata-product-card-tag">
          {product.tag ? <OfferTag tone={product.tagTone}>{product.tag}</OfferTag> : null}
        </div>
        <h3 className="strata-product-name" title={product.name}>
          <LinkTo link={link}>{product.name}</LinkTo>
        </h3>
      </div>
      <div className="strata-product-card-price">
        <Price amount={product.price} unit={product.unit} />
        <AddButton product={product.id} label={product.name} />
      </div>
    </article>
  );
}

export function CatalogueCard({ id }: { id: string }) {
  const store = useStore();
  const item = store?.product(id);
  if (!store || !item) return null;
  return (
    <article className="strata-catalogue-card">
      <LinkTo className="strata-catalogue-card-media" link={`product/${id}`} tabIndex={-1} aria-hidden="true">
        <img src={item.image} alt="" />
      </LinkTo>
      <div className="strata-catalogue-card-info">
        <div className="strata-catalogue-card-text">
          <h3 className="strata-product-name">
            <LinkTo link={`product/${id}`}>{item.name}</LinkTo>
          </h3>
          {item.material ? <span className="strata-catalogue-card-material">{item.material}</span> : null}
        </div>
        <span className="strata-price-amount">{store.money(Math.round(item.price * 100))}</span>
      </div>
    </article>
  );
}

export type Category = { name: string; count?: string; image: string; link?: string };

export function CategoryTile({ category }: { category: Category }) {
  return (
    <LinkTo className="strata-category-tile" link={category.link} style={{ backgroundImage: `url(${category.image})` }}>
      <span className="strata-category-label">
        <span className="strata-category-name">{category.name}</span>
        {category.count ? <span className="strata-category-count">{category.count}</span> : null}
      </span>
    </LinkTo>
  );
}

export function SectionHeader({
  title,
  subtitle,
  linkLabel,
  link,
  actions,
}: {
  title: string;
  subtitle?: string;
  linkLabel?: string;
  link?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="strata-section-header">
      <div className="strata-section-title-group">
        <h2 className="strata-section-title">{title}</h2>
        {subtitle ? <span className="strata-section-subtitle">{subtitle}</span> : null}
      </div>
      <div className="strata-section-actions">
        {linkLabel ? (
          <LinkTo className="strata-section-link" link={link}>
            {linkLabel}
          </LinkTo>
        ) : null}
        {actions}
      </div>
    </div>
  );
}

export function ProductFigure({ product }: { product: Pick<Product, "id" | "name" | "price" | "image"> }) {
  return (
    <figure className="strata-product-figure">
      <img src={product.image} alt="" />
      <figcaption>
        <LinkTo className="strata-product-name" link={product.id ? `product/${product.id}` : undefined}>
          {product.name}
        </LinkTo>
        <span className="strata-price-amount">{product.price}</span>
      </figcaption>
    </figure>
  );
}

export function ArrowButton({
  direction,
  ...rest
}: { direction: "previous" | "next" } & Omit<ComponentPropsWithoutRef<"button">, "children">) {
  return (
    <IconButton variant="secondary" shape="circle" label={direction === "previous" ? "Previous" : "Next"} {...rest}>
      <Icon name={direction === "previous" ? "chevron-left" : "chevron-right"} />
    </IconButton>
  );
}

export function ChevronButton({
  direction,
  ...rest
}: { direction: "previous" | "next" } & Omit<ComponentPropsWithoutRef<"button">, "children">) {
  return (
    <button type="button" className="strata-chevron-button" aria-label={direction === "previous" ? "Previous" : "Next"} {...rest}>
      <Icon name={direction === "previous" ? "chevron-left" : "chevron-right"} />
    </button>
  );
}

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  label,
  surface = "filled",
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  label: string;
  surface?: "filled" | "plain";
}) {
  return (
    <div className="strata-stepper" data-surface={surface} role="group" aria-label={`Quantity of ${label}`}>
      <button type="button" aria-label="Decrease" disabled={value <= min} onClick={() => onChange(value - 1)}>
        <Icon name="minus" />
      </button>
      <output aria-live="polite">{value}</output>
      <button type="button" aria-label="Increase" disabled={value >= 99} onClick={() => onChange(value + 1)}>
        <Icon name="plus" />
      </button>
    </div>
  );
}

export function AccordionRow({ title, body, defaultOpen = false }: { title: string; body: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className="strata-accordion-row" data-open={open || undefined}>
      <button type="button" className="strata-accordion-head" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        <span>{title}</span>
        <Icon name={open ? "minus" : "plus"} />
      </button>
      <p id={id} className="strata-accordion-body" hidden={!open}>
        {body}
      </p>
    </div>
  );
}

export type Crumb = { label: string; link?: string };

export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav className="strata-breadcrumb" aria-label="Breadcrumb">
      <ol>
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`}>
              {last ? (
                <span aria-current="page">{item.label}</span>
              ) : (
                <LinkTo link={item.link}>{item.label}</LinkTo>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function FilterChip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" className="strata-filter-chip" aria-pressed={selected} data-selected={selected || undefined} onClick={onClick}>
      {label}
    </button>
  );
}

export function ToolbarButton({ icon, children }: { icon?: IconName; children: ReactNode }) {
  return (
    <button type="button" className="strata-toolbar-button">
      {icon ? <Icon name={icon} /> : null}
      {children}
    </button>
  );
}

export function SummaryRow({ label, value, kind = "default" }: { label: string; value: string; kind?: "default" | "saving" | "total" }) {
  return (
    <div className="strata-summary-row" data-kind={kind}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function Checkbox({ checked, onChange, children }: { checked: boolean; onChange: () => void; children: ReactNode }) {
  return (
    <label className="strata-checkbox">
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className="strata-checkbox-box" aria-hidden="true">
        {checked ? <Icon name="check" size={14} /> : null}
      </span>
      {children}
    </label>
  );
}

export function ColourOption({
  name,
  swatch,
  selected,
  onSelect,
}: {
  name: string;
  swatch: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className="strata-colour-option"
      role="radio"
      aria-checked={selected}
      aria-label={name}
      data-selected={selected || undefined}
      onClick={onSelect}
    >
      {/* swatch is product data, not a token */}
      <span style={{ background: swatch }} />
    </button>
  );
}

export function priceOf(item: CatalogueProduct) {
  return Math.round(item.price * 100);
}

export { Button };
