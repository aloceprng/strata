"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { BrandProvider, BrandStylesheet } from "../components/BrandProvider";
import { tokenVariable } from "../sections/Intro";
import { ScreenRenderer, type Screen } from "../sections/ScreenRenderer";
import type { Catalogue } from "../store/catalogue";
import { StoreProvider } from "../store/StoreProvider";
import {
  EXAMPLES,
  outcomeOf,
  parseDrafts,
  screenOfChange,
  type Check,
  type Layouts,
  type Pipeline,
} from "./model";
import styles from "./pipeline.module.css";
import { Reference } from "./Reference";

const BRANDS = ["clementine", "pomelo"];
const CHECK_DELAY_MS = 250;
const FRAME_WIDTH = 1280;

// the order a shopper meets the screens; unknown screens go last
const SCREEN_ORDER = ["home", "shop", "product", "basket"];
const rank = (screen: string) => (SCREEN_ORDER.includes(screen) ? SCREEN_ORDER.indexOf(screen) : SCREEN_ORDER.length);

const pretty = (screen: Screen) => JSON.stringify(screen, null, 2);

export default function PipelinePage() {
  const [brand, setBrand] = useState(BRANDS[0]);

  return (
    <>
      {BRANDS.map((b) => (
        <BrandStylesheet key={b} brand={b} />
      ))}
      <div className={styles.page}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>strata</p>
            <h1 className={styles.title}>Publish pipeline</h1>
            <p className={styles.lead}>
              Edit any screen and see what publishing it would do. These are the real publish
              checks, run as a dry run against every screen: nothing here is saved.
            </p>
          </div>
          <nav className={styles.tabs} aria-label="Brand">
            {BRANDS.map((b) => (
              <button
                key={b}
                type="button"
                className={styles.tab}
                aria-pressed={b === brand}
                onClick={() => setBrand(b)}
              >
                {b}
              </button>
            ))}
          </nav>
        </header>
        <Workbench key={brand} brand={brand} />
      </div>
    </>
  );
}

function Workbench({ brand }: { brand: string }) {
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState("home");
  const [check, setCheck] = useState<Check | null>(null);
  const [brokenScreen, setBrokenScreen] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Layouts | null>(null);
  const [catalogue, setCatalogue] = useState<Catalogue | undefined>(undefined);
  const [product, setProduct] = useState<string | null>(null);

  // the preview needs the catalogue to resolve product ids
  useEffect(() => {
    let cancelled = false;
    fetch(`/artifacts/${brand}/latest/catalogue.json`)
      .then((response) => (response.ok ? response.json() : undefined))
      .catch(() => undefined)
      .then((loaded: Catalogue | undefined) => {
        if (cancelled) return;
        setCatalogue(loaded);
        setProduct(Object.keys(loaded?.products ?? {})[0] ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [brand]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/brands/${brand}/pipeline`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`the API returned ${response.status}`);
        return response.json();
      })
      .then((loaded: Pipeline) => {
        setPipeline(loaded);
        setTexts(
          Object.fromEntries(Object.entries(loaded.layouts).map(([name, screen]) => [name, pretty(screen)])),
        );
        const names = Object.keys(loaded.layouts);
        setSelected((current) => (names.includes(current) ? current : names[0]));
      })
      .catch((error: Error) => {
        if (error.name !== "AbortError") setLoadError(error.message);
      });
    return () => controller.abort();
  }, [brand]);

  // one publish covers every screen, so every edit checks the whole bundle
  useEffect(() => {
    if (!Object.keys(texts).length) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const draft = parseDrafts(texts);
      if (!draft.ok) {
        setBrokenScreen(draft.screen);
        setCheck({ verdict: "refused", error: draft.error, changes: [] });
        return;
      }
      setBrokenScreen(null);
      fetch(`/api/brands/${brand}/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layouts: draft.layouts }),
        signal: controller.signal,
      })
        .then((response) => {
          if (!response.ok) throw new Error(`the API returned ${response.status}`);
          return response.json();
        })
        .then((result: Check) => {
          setCheck(result);
          if (result.verdict !== "refused") setPreviews(draft.layouts);
        })
        .catch((error: Error) => {
          if (error.name === "AbortError") return;
          setCheck({ verdict: "refused", error: `Check failed: ${error.message}`, changes: [] });
        });
    }, CHECK_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [brand, texts]);

  if (loadError) {
    return (
      <p className={styles.notice} role="alert">
        Could not load {brand}: {loadError}. Is Django running?
      </p>
    );
  }
  if (!pipeline) return <p className={styles.notice}>Loading {brand}…</p>;

  const screens = Object.keys(pipeline.layouts).sort((a, b) => rank(a) - rank(b));
  const published = pipeline.layouts[selected];
  const changes = check?.changes ?? [];
  const changesOn = (name: string) => changes.filter((change) => screenOfChange(change) === name);
  const edited = (name: string) => texts[name] !== pretty(pipeline.layouts[name]);
  const groups = [
    ...screens.map((name) => ({ name, list: changesOn(name), screen: true })),
    { name: "other", list: changes.filter((change) => !screens.includes(screenOfChange(change))), screen: false },
  ].filter((group) => group.list.length);
  const preview = previews?.[selected] ?? null;
  const outcome = check ? outcomeOf(check) : null;
  const refused = check?.verdict === "refused";
  const products = Object.entries(catalogue?.products ?? {});
  const current = selected === "product" ? product : null;

  const apply = (change: (screen: Screen) => Screen) => {
    setTexts((draft) => ({ ...draft, [selected]: pretty(change(published)) }));
  };

  return (
    <>
      <section className={styles.verdict} data-tone={outcome?.tone} aria-live="polite">
        <strong>{outcome?.title ?? "Checking…"}</strong>
        <span>{outcome?.detail}</span>
      </section>

      <nav className={styles.screens} aria-label="Screen">
        {screens.map((name) => {
          const count = changesOn(name).length;
          return (
            <button
              key={name}
              type="button"
              className={styles.screenTab}
              aria-pressed={name === selected}
              data-broken={name === brokenScreen || undefined}
              onClick={() => setSelected(name)}
            >
              {name}
              {count ? (
                <span className={styles.count} aria-label={`, ${count} changes`}>
                  {count}
                </span>
              ) : edited(name) ? (
                <span className={styles.dot} aria-label=", edited" />
              ) : null}
            </button>
          );
        })}
      </nav>

      <main className={styles.grid}>
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Draft · {selected}</h2>
          <div className={styles.examples}>
            {EXAMPLES.map((example) => (
              <button
                key={example.label}
                type="button"
                className={styles.example}
                disabled={example.appliesTo ? !example.appliesTo(published) : false}
                onClick={() => apply(example.change)}
              >
                {example.label}
              </button>
            ))}
          </div>
          <textarea
            className={styles.editor}
            aria-label={`${brand} ${selected} draft layout JSON`}
            spellCheck={false}
            value={texts[selected] ?? ""}
            onChange={(event) => {
              const value = event.target.value;
              setTexts((draft) => ({ ...draft, [selected]: value }));
            }}
          />
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>Preview{refused ? " · last valid draft" : ""}</h2>
            {selected === "product" && products.length ? (
              <label className={styles.picker}>
                Product
                <select value={product ?? ""} onChange={(event) => setProduct(event.target.value)}>
                  {products.map(([id, item]) => (
                    <option key={id} value={id}>
                      {item.name ?? id}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
          <BrandProvider brand={brand}>
            <StoreProvider key={current ?? "screen"} brand={brand} catalogue={catalogue} current={current}>
              {preview ? (
                <ScaledFrame>
                  <div
                    className="strata-screen"
                    data-fit={preview.fit ?? "scroll"}
                    data-screen={selected}
                    style={preview.gap ? { gap: tokenVariable(preview.gap) } : undefined}
                  >
                    <ScreenRenderer screen={preview} />
                  </div>
                </ScaledFrame>
              ) : (
                <p className={styles.empty}>No valid draft of {selected} yet.</p>
              )}
            </StoreProvider>
          </BrandProvider>
        </section>

        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Changes against published</h2>
          {groups.length ? (
            <div className={styles.groups}>
              {groups.map((group) => (
                <div key={group.name} className={styles.group} data-current={group.name === selected || undefined}>
                  <button
                    type="button"
                    className={styles.groupHead}
                    disabled={!group.screen}
                    onClick={() => setSelected(group.name)}
                  >
                    {group.name} <span>{group.list.length}</span>
                  </button>
                  <ul className={styles.list}>
                    {group.list.map((change) => (
                      <li key={`${change.kind}:${change.path}`} className={styles.change}>
                        <span className={styles.badge} data-severity={change.severity}>
                          {change.severity}
                        </span>
                        <span>
                          <code>{change.path}</code>
                          <small>{change.reason}</small>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.empty}>No changes.</p>
          )}
        </section>

        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Version history</h2>
          <ol className={styles.list}>
            {pipeline.versions.map((version) => (
              <li key={version.version} className={styles.change}>
                <span className={styles.badge} data-severity={version.severity || "none"}>
                  {version.severity || version.status}
                </span>
                <span>
                  <code>v{version.version}</code>
                  <small>{version.note || "No note"}</small>
                </span>
              </li>
            ))}
          </ol>
        </section>
      </main>

      {pipeline.reference ? (
        <Reference
          key={selected}
          reference={pipeline.reference}
          inUse={(preview ?? published)?.sections.map((s) => s.type) ?? []}
        />
      ) : null}
    </>
  );
}

/** Renders at desktop width and scales down to fit the panel, so the preview matches the real page. */
function ScaledFrame({ children }: { children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ scale: number; height: number } | null>(null);

  useEffect(() => {
    const box = outer.current;
    const page = inner.current;
    if (!box || !page || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const scale = Math.min(1, box.clientWidth / FRAME_WIDTH);
      setSize({ scale, height: page.offsetHeight * scale });
    });
    observer.observe(box);
    observer.observe(page);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={outer} className={styles.frame} style={size ? { height: size.height } : undefined}>
      <div
        ref={inner}
        className={styles.frameInner}
        style={{ width: FRAME_WIDTH, transform: size ? `scale(${size.scale})` : undefined }}
      >
        {children}
      </div>
    </div>
  );
}
