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
  const [bundle, setBundle] = useState<Bundle | null>(() => CACHE.get(brand) ?? null);

  useEffect(() => {
    const cached = CACHE.get(brand);
    if (cached) {
      setBundle(cached);
      return;
    }
    let cancelled = false;
    fetch(`/artifacts/${brand}/latest/tokens.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((loaded: Bundle | null) => {
        if (!loaded) return;
        CACHE.set(brand, loaded);
        if (!cancelled) setBundle(loaded);
      })
      .catch(() => {
        
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
  // eslint-disable-next-line @next/next/no-css-tags
  return <link rel="stylesheet" href={`/artifacts/${brand}/latest/theme.css`} />;
}
