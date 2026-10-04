"use client";

import { useBrand, type TokenEntry } from "../components/BrandProvider";
import styles from "./system.module.css";

type Pair = [string, TokenEntry];

const PREFIX: Record<string, string> = {
  primitive: "--p-",
  semantic: "--",
  component: "--component-",
};

function cssVar(path: string): string {
  const [layer, ...rest] = path.split(".");
  return (PREFIX[layer] ?? `--${layer}-`) + rest.join("-");
}

const byPath = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

function display(value: TokenEntry["value"]): string {
  return Array.isArray(value) ? value.join(", ") : String(value);
}

function shortName(path: string): string {
  return path.split(".").slice(2).join(".");
}

function useTokens(layer: string, group?: string): Pair[] {
  const { bundle } = useBrand();
  if (!bundle) return [];
  return Object.entries(bundle.tokens)
    .filter(([p]) => {
      const [l, g] = p.split(".");
      return l === layer && (group ? g === group : true);
    })
    .sort(([a], [b]) => byPath(a, b));
}

function useReferenced(): Set<string> {
  const { bundle } = useBrand();
  if (!bundle) return new Set();
  return new Set(
    Object.values(bundle.tokens)
      .map((t) => t.aliasedFrom)
      .filter(Boolean) as string[],
  );
}

function groupBy(pairs: Pair[], depth: number): Map<string, Pair[]> {
  const out = new Map<string, Pair[]>();
  for (const pair of pairs) {
    const key = pair[0].split(".").slice(2, 2 + depth).join(".");
    if (!out.has(key)) out.set(key, []);
    out.get(key)!.push(pair);
  }
  return out;
}

function Swatch({ path, entry, used }: { path: string; entry: TokenEntry; used?: boolean }) {
  const value = display(entry.value);
  const name = shortName(path);
  return (
    <div className={styles.swatch} data-used={used || undefined}>
      <span className={styles.swatchBox} style={{ background: value }} />
      <span className={styles.swatchTip}>
        <code>{name}</code>
        <code className={styles.swatchHex}>{value}</code>
        {entry.aliasedFrom ? (
          <code className={styles.swatchAlias}>← {shortName(entry.aliasedFrom)}</code>
        ) : null}
      </span>
    </div>
  );
}

export function ColourGrid({ layer }: { layer: "primitive" | "semantic" }) {
  const tokens = useTokens(layer, "colour");
  const referenced = useReferenced();
  const groups = groupBy(tokens, 1);

  return (
    <div className={styles.colourGroups}>
      {[...groups.entries()].map(([group, items]) => (
        <div key={group} className={styles.colourGroup}>
          <code className={styles.groupLabel}>{group}</code>
          <div className={styles.swatchRow}>
            {items.map(([path, entry]) => (
              <Swatch
                key={path}
                path={path}
                entry={entry}
                used={layer === "primitive" ? referenced.has(path) : undefined}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ValueGrid({
  layer,
  groups,
  sample,
}: {
  layer: "primitive" | "semantic" | "component";
  groups: string[];
  
  sample?: (entry: TokenEntry, leaf: string) => React.ReactNode;
}) {
  const { bundle } = useBrand();
  if (!bundle) return null;

  const pairs = Object.entries(bundle.tokens)
    .filter(([p]) => {
      const [l, g] = p.split(".");
      return l === layer && groups.includes(g);
    })
    .sort(([a], [b]) => byPath(a, b));

  return (
    <div className={styles.valueGrid}>
      {pairs.map(([path, entry]) => {
        const leaf = path.split(".").pop() ?? "";
        return (
          <div key={path} className={styles.valueItem} title={cssVar(path)}>
            {sample ? (
              <span className={styles.valueSample}>{sample(entry, leaf)}</span>
            ) : null}
            <code className={styles.valueName}>{shortName(path)}</code>
            <code className={styles.valueText}>{display(entry.value)}</code>
          </div>
        );
      })}
    </div>
  );
}

export const scaleSample = (entry: TokenEntry) => {
  const v = display(entry.value);
  return (
    <span
      className={styles.miniBar}
      style={{ width: `min(${v}, 56px)`, opacity: v === "0px" ? 0.3 : 1 }}
    />
  );
};

export const radiusSample = (entry: TokenEntry) => (
  <span className={styles.miniRadius} style={{ borderRadius: display(entry.value) }} />
);

export const typeSample = (entry: TokenEntry, leaf: string) => {
  const v = display(entry.value);
  const style: React.CSSProperties = {};
  if (leaf === "size") style.fontSize = `min(${v}, 20px)`;
  if (leaf === "weight") style.fontWeight = v;
  if (leaf === "family") style.fontFamily = v;
  if (leaf === "tracking") style.letterSpacing = v;
  return (
    <span className={styles.miniType} style={style}>
      Ag
    </span>
  );
};

export const elevationSample = (entry: TokenEntry) => (
  <span className={styles.miniElevation} style={{ boxShadow: display(entry.value) }} />
);

export function DefaultTokens() {
  const tokens = useTokens("component");
  return (
    <div className={styles.defaults}>
      {tokens.map(([path, entry]) => (
        <div key={path} className={styles.defaultItem}>
          <code>{shortName(path)}</code>
          <span>{display(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}
