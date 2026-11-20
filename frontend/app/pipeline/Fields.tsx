"use client";

import { useId, useState } from "react";

import type { Catalogue } from "../store/catalogue";
import { ASSET_PATH, humanize, isPlaceholder, labelOf, move, tokenLabel } from "./editor";
import { sampleProps, type PropRule } from "./model";
import styles from "./pipeline.module.css";

export type FieldContext = {
  tokens: Record<string, string[]>;
  screens: string[];
  assets: string[];
  catalogue?: Catalogue;
};

type Values = Record<string, unknown>;

// longer copy gets a multi-line box; a headline may hold a line break
const MULTILINE = new Set(["body", "headline", "newsletterBody", "description"]);
const PRODUCT_LINK = /^product\/(.+)$/;

/** props form for a section or one list row */
export function Fields({
  values,
  rules,
  context,
  onChange,
}: {
  values: Values;
  rules: Record<string, PropRule>;
  context: FieldContext;
  onChange: (values: Values) => void;
}) {
  const set = (name: string, value: unknown) => {
    const next = { ...values };
    if (value === undefined) delete next[name];
    else next[name] = value;
    onChange(next);
  };

  return (
    <div className={styles.fields}>
      {Object.entries(rules).map(([name, rule]) => (
        <Field key={name} name={name} rule={rule} value={values[name]} context={context} onChange={(v) => set(name, v)} />
      ))}
    </div>
  );
}

function Field({
  name,
  rule,
  value,
  context,
  onChange,
}: {
  name: string;
  rule: PropRule;
  value: unknown;
  context: FieldContext;
  onChange: (value: unknown) => void;
}) {
  const id = useId();
  const label = labelOf(name, rule);
  const hint = isPlaceholder(value) ? "Placeholder: replace it" : null;

  if (rule.type === "list") {
    return <ListField label={label} rule={rule} value={value} context={context} onChange={onChange} />;
  }
  if (rule.type === "products") {
    return <ProductsField label={label} rule={rule} value={value} context={context} onChange={onChange} />;
  }
  if (rule.type === "boolean") {
    return (
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={value === true}
          onChange={(event) => onChange(event.target.checked ? true : rule.required ? false : undefined)}
        />
        {label}
      </label>
    );
  }

  let control;
  let error: string | null = null;
  switch (rule.type) {
    case "enum":
      control = (
        <select id={id} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value || undefined)}>
          {rule.required && value !== undefined ? null : <option value="">Default</option>}
          {(rule.values ?? []).map((option) => (
            <option key={option} value={option}>
              {humanize(option)}
            </option>
          ))}
        </select>
      );
      break;
    case "token": {
      const group = rule.group ?? "";
      const options = context.tokens[group] ?? [];
      control = (
        <select id={id} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value || undefined)}>
          {rule.required && value !== undefined ? null : <option value="">Default</option>}
          {typeof value === "string" && !options.includes(value) ? <option value={value}>{tokenLabel(value, group)}</option> : null}
          {options.map((token) => (
            <option key={token} value={token}>
              {tokenLabel(token, group)}
            </option>
          ))}
        </select>
      );
      break;
    }
    case "number": {
      const n = typeof value === "number" ? value : undefined;
      if (n !== undefined && ((rule.min !== undefined && n < rule.min) || (rule.max !== undefined && n > rule.max))) {
        error = `Between ${rule.min} and ${rule.max}`;
      }
      control = (
        <input
          id={id}
          type="number"
          min={rule.min}
          max={rule.max}
          value={n ?? ""}
          placeholder="Default"
          aria-invalid={error ? true : undefined}
          onChange={(e) => onChange(e.target.value === "" ? (rule.required ? rule.min ?? 0 : undefined) : Number(e.target.value))}
        />
      );
      break;
    }
    case "asset":
      return <AssetField id={id} label={label} rule={rule} value={value} context={context} onChange={onChange} />;
    case "link":
      control = <LinkSelect id={id} rule={rule} value={value} context={context} onChange={onChange} />;
      break;
    default: {
      const text = typeof value === "string" ? value : "";
      if (rule.required && !text.trim()) error = "Required";
      const common = {
        id,
        value: text,
        "aria-invalid": error ? true : undefined,
        onChange: (e: { target: { value: string } }) =>
          onChange(e.target.value === "" && !rule.required ? undefined : e.target.value),
      };
      control = MULTILINE.has(name) || text.includes("\n") ? <textarea rows={2} {...common} /> : <input type="text" {...common} />;
    }
  }

  return (
    <div className={styles.field}>
      <label htmlFor={id}>
        {label}
        {rule.required ? <span className={styles.required} aria-hidden> *</span> : null}
      </label>
      {control}
      {error ? <span className={styles.fieldError}>{error}</span> : hint ? <span className={styles.fieldHint}>{hint}</span> : null}
    </div>
  );
}

function LinkSelect({
  id,
  rule,
  value,
  context,
  onChange,
}: {
  id: string;
  rule: PropRule;
  value: unknown;
  context: FieldContext;
  onChange: (value: unknown) => void;
}) {
  const products = Object.entries(context.catalogue?.products ?? {});
  const current = typeof value === "string" ? value : "";
  const product = PRODUCT_LINK.exec(current)?.[1];
  const choice = product !== undefined ? "product" : current;

  return (
    <div className={styles.inline}>
      <select
        id={id}
        value={choice}
        onChange={(e) => {
          const next = e.target.value;
          if (next === "product") onChange(`product/${products[0]?.[0] ?? ""}`);
          else onChange(next || undefined);
        }}
      >
        {rule.required ? null : <option value="">Nowhere</option>}
        {choice && choice !== "product" && !context.screens.includes(choice) ? <option value={choice}>{choice} (missing)</option> : null}
        {context.screens.map((screen) => (
          <option key={screen} value={screen}>
            {humanize(screen)}
          </option>
        ))}
        {products.length ? <option value="product">A product…</option> : null}
      </select>
      {product !== undefined ? (
        <select aria-label="Product" value={product} onChange={(e) => onChange(`product/${e.target.value}`)}>
          {products.map(([pid, item]) => (
            <option key={pid} value={pid}>
              {item.name ?? pid}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}

const CUSTOM = "__custom";

function AssetField({
  id,
  label,
  rule,
  value,
  context,
  onChange,
}: {
  id: string;
  label: string;
  rule: PropRule;
  value: unknown;
  context: FieldContext;
  onChange: (value: unknown) => void;
}) {
  const current = typeof value === "string" ? value : "";
  const [custom, setCustom] = useState(() => current !== "" && !context.assets.includes(current));
  const error = current && !ASSET_PATH.test(current) ? "Use a path like /products/brand/name.png" : rule.required && !current ? "Required" : null;
  const hint = isPlaceholder(current) ? "Placeholder: pick a real image" : null;

  return (
    <div className={styles.field}>
      <label htmlFor={id}>
        {label}
        {rule.required ? <span className={styles.required} aria-hidden> *</span> : null}
      </label>
      <div className={styles.inline}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {current && ASSET_PATH.test(current) && !isPlaceholder(current) ? <img className={styles.assetThumb} src={current} alt="" /> : null}
        <select
          id={id}
          value={custom ? CUSTOM : current}
          onChange={(e) => {
            if (e.target.value === CUSTOM) {
              setCustom(true);
              return;
            }
            setCustom(false);
            onChange(e.target.value || undefined);
          }}
        >
          {rule.required && current ? null : <option value="">None</option>}
          {context.assets.map((asset) => (
            <option key={asset} value={asset}>
              {asset.split("/").pop()}
            </option>
          ))}
          <option value={CUSTOM}>Custom path…</option>
        </select>
      </div>
      {custom ? (
        <input
          type="text"
          aria-label={`${label} path`}
          value={current}
          placeholder="/products/brand/name.png"
          aria-invalid={error ? true : undefined}
          onChange={(e) => onChange(e.target.value || undefined)}
        />
      ) : null}
      {error ? <span className={styles.fieldError}>{error}</span> : hint ? <span className={styles.fieldHint}>{hint}</span> : null}
    </div>
  );
}

function limits(rule: PropRule, count: number, noun: string) {
  const plural = (n: number) => `${n} ${noun}${n === 1 ? "" : "s"}`;
  return {
    canAdd: rule.max === undefined || count < rule.max,
    canRemove: count > (rule.min ?? 0),
    addReason: rule.max !== undefined && count >= rule.max ? `At most ${plural(rule.max)}` : null,
    removeReason: rule.min !== undefined && count <= rule.min ? `Needs at least ${plural(rule.min)}` : null,
  };
}

function ListField({
  label,
  rule,
  value,
  context,
  onChange,
}: {
  label: string;
  rule: PropRule;
  value: unknown;
  context: FieldContext;
  onChange: (value: unknown) => void;
}) {
  const rows = Array.isArray(value) ? (value as Values[]) : [];
  const items = rule.items ?? {};
  const { canAdd, canRemove, addReason, removeReason } = limits(rule, rows.length, "item");
  const commit = (next: Values[]) => onChange(next.length || rule.required ? next : undefined);
  const noun = label.replace(/s$/, "").toLowerCase();

  return (
    <fieldset className={styles.list}>
      <legend>
        {label}
        {rule.required ? <span className={styles.required} aria-hidden> *</span> : null}
      </legend>
      {rows.map((row, index) => (
        <div key={index} className={styles.row}>
          <div className={styles.rowHead}>
            <span>
              {humanize(noun)} {index + 1}
            </span>
            <span className={styles.rowActions}>
              <button type="button" className={styles.icon} disabled={index === 0} aria-label={`Move ${noun} ${index + 1} up`} onClick={() => commit(move(rows, index, index - 1))}>
                ↑
              </button>
              <button type="button" className={styles.icon} disabled={index === rows.length - 1} aria-label={`Move ${noun} ${index + 1} down`} onClick={() => commit(move(rows, index, index + 1))}>
                ↓
              </button>
              <button type="button" className={styles.icon} disabled={!canRemove} aria-label={`Delete ${noun} ${index + 1}`} title={removeReason ?? undefined} onClick={() => commit(rows.filter((_, i) => i !== index))}>
                ✕
              </button>
            </span>
          </div>
          <Fields values={row} rules={items} context={context} onChange={(next) => commit(rows.map((r, i) => (i === index ? next : r)))} />
        </div>
      ))}
      <div className={styles.inline}>
        <button type="button" className={styles.example} disabled={!canAdd} onClick={() => commit([...rows, sampleProps(items, context.tokens)])}>
          Add {noun}
        </button>
        {addReason ? <span className={styles.fieldHint}>{addReason}</span> : null}
        {removeReason && rows.length ? <span className={styles.fieldHint}>{removeReason}</span> : null}
      </div>
    </fieldset>
  );
}

function ProductsField({
  label,
  rule,
  value,
  context,
  onChange,
}: {
  label: string;
  rule: PropRule;
  value: unknown;
  context: FieldContext;
  onChange: (value: unknown) => void;
}) {
  const [query, setQuery] = useState("");
  const catalogue = context.catalogue?.products ?? {};
  const ids = Array.isArray(value) ? (value as string[]) : [];
  const { canAdd, canRemove, addReason, removeReason } = limits(rule, ids.length, "product");
  const commit = (next: string[]) => onChange(next.length || rule.required ? next : undefined);
  const needle = query.trim().toLowerCase();
  const matches = needle
    ? Object.entries(catalogue)
        .filter(([id, item]) => !ids.includes(id) && `${item.name} ${id}`.toLowerCase().includes(needle))
        .slice(0, 6)
    : [];

  return (
    <fieldset className={styles.list}>
      <legend>
        {label}
        {rule.required ? <span className={styles.required} aria-hidden> *</span> : null}
      </legend>
      <ul className={styles.products}>
        {ids.map((id, index) => {
          const item = catalogue[id];
          return (
            <li key={id} className={styles.product}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {item?.image ? <img className={styles.assetThumb} src={item.image} alt="" /> : null}
              <span>{item?.name ?? `${id} (not in catalogue)`}</span>
              <span className={styles.rowActions}>
                <button type="button" className={styles.icon} disabled={index === 0} aria-label={`Move ${item?.name ?? id} up`} onClick={() => commit(move(ids, index, index - 1))}>
                  ↑
                </button>
                <button type="button" className={styles.icon} disabled={index === ids.length - 1} aria-label={`Move ${item?.name ?? id} down`} onClick={() => commit(move(ids, index, index + 1))}>
                  ↓
                </button>
                <button type="button" className={styles.icon} disabled={!canRemove} aria-label={`Remove ${item?.name ?? id}`} title={removeReason ?? undefined} onClick={() => commit(ids.filter((x) => x !== id))}>
                  ✕
                </button>
              </span>
            </li>
          );
        })}
      </ul>
      {canAdd ? (
        <div className={styles.field}>
          <input type="search" aria-label={`Add to ${label}`} placeholder="Search products to add" value={query} onChange={(e) => setQuery(e.target.value)} />
          {matches.length ? (
            <ul className={styles.products}>
              {matches.map(([id, item]) => (
                <li key={id}>
                  <button
                    type="button"
                    className={styles.match}
                    onClick={() => {
                      commit([...ids, id]);
                      setQuery("");
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {item.image ? <img className={styles.assetThumb} src={item.image} alt="" /> : null}
                    Add {item.name ?? id}
                  </button>
                </li>
              ))}
            </ul>
          ) : needle ? (
            <span className={styles.fieldHint}>No other products match.</span>
          ) : null}
        </div>
      ) : (
        <span className={styles.fieldHint}>{addReason}</span>
      )}
      {removeReason && ids.length ? <span className={styles.fieldHint}>{removeReason}</span> : null}
    </fieldset>
  );
}
