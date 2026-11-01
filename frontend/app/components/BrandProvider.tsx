"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type ComponentDefaults = {
  button?: { variant?: string; size?: string };
  card?: { elevation?: string };
};

export type TokenEntry = {
  value: string | number | string[];
  type: string | null;
  aliasedFrom?: string;
  description?: string;
};

export type Bundle = {
  brand: string;
  tokenCount: number;
  maxChainDepth: number;
  tokens: Record<string, TokenEntry>;
  cssVariables: Record<string, string>;
  componentDefaults: ComponentDefaults;
};

type BrandContext = {
  brand: string;
  defaults: ComponentDefaults;
  bundle: Bundle | null;
};

const Context = createContext<BrandContext>({
  brand: "",
  defaults: {},
  bundle: null,
});

const CACHE = new Map<string, Bundle>();

export function useBrand() {
  return useContext(Context);
}

export function useDefault<T extends string>(
  override: T | undefined,
  pick: (d: ComponentDefaults) => string | undefined,
  fallback: T,
): T {
  const { defaults } = useBrand();
  return (override ?? (pick(defaults) as T | undefined) ?? fallback) as T;
}

export function BrandProvider({
  brand,
  scope = true,
  children,
}: {
  brand: string;
  
  scope?: boolean;
  children: ReactNode;
}) {
  const [fetched, setFetched] = useState<Bundle | null>(null);
  const bundle = CACHE.get(brand) ?? (fetched?.brand === brand ? fetched : null);

  useEffect(() => {
    if (CACHE.has(brand)) return;
    let cancelled = false;
    const url = `/artifacts/${brand}/latest/tokens.json`;
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`${url} returned ${r.status}`);
        return r.json();
      })
      .then((loaded: Bundle) => {
        CACHE.set(brand, loaded);
        if (!cancelled) setFetched(loaded);
      })
      .catch((error: unknown) => {
        console.error(`[strata] ${brand}: component defaults unavailable`, error);
      });
    return () => {
      cancelled = true;
    };
  }, [brand]);

  const value = { brand, bundle, defaults: bundle?.componentDefaults ?? {} };

  return (
    <Context.Provider value={value}>
      {scope ? <div data-brand={brand}>{children}</div> : children}
    </Context.Provider>
  );
}

export function BrandStylesheet({ brand }: { brand: string }) {
  return <link rel="stylesheet" href={`/artifacts/${brand}/latest/theme.css`} />;
}
