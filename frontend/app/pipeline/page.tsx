"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { BrandProvider, BrandStylesheet } from "../components/BrandProvider";
import { StrataLogo } from "../components/StrataLogo";
import { tokenVariable } from "../sections/Intro";
import { SECTIONS, type Screen } from "../sections/ScreenRenderer";
import type { Catalogue } from "../store/catalogue";
import { StoreProvider } from "../store/StoreProvider";
import { inDraftOrder, issuesOf, knownAssets, labelOf, linkableScreens } from "./editor";
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
import { SectionEditor } from "./SectionEditor";

const BRANDS = ["clementine", "pomelo"];
const CHECK_DELAY_MS = 250;
const FRAME_WIDTH = 1280;

// the order a shopper meets the screens; unknown screens go last
const SCREEN_ORDER = ["home", "shop", "product", "basket"];
const rank = (screen: string) => (SCREEN_ORDER.includes(screen) ? SCREEN_ORDER.indexOf(screen) : SCREEN_ORDER.length);

const pretty = (screen: Screen) => JSON.stringify(screen, null, 2);

function parseScreen(text: string | undefined): Screen | null {
  try {
    const screen = JSON.parse(text ?? "");
    return screen && typeof screen === "object" && Array.isArray(screen.sections) ? screen : null;
  } catch {
    return null;
  }
}

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
            <p className={styles.eyebrow}><StrataLogo height={11} /></p>
            <h1 className={styles.title}>Publish pipeline</h1>
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
  const [mode, setMode] = useState<"cards" | "json">("cards");
  const [section, setSection] = useState<string | null>(null);

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

  const draft = useMemo(() => parseScreen(texts[selected]), [texts, selected]);
  // client-side checks across every screen in the publish
  const localIssue = useMemo(() => {
    const rules = pipeline?.reference?.sections ?? {};
    for (const [name, text] of Object.entries(texts)) {
      for (const s of parseScreen(text)?.sections ?? []) {
        const definition = rules[s.type];
        const issue = definition ? issuesOf(s.props ?? {}, definition.props)[0] : undefined;
        if (definition && issue) {
          return `${name} › ${labelOf(s.type, definition)} › ${issue.path.join(" › ")} ${issue.message}`;
        }
      }
    }
    return null;
  }, [texts, pipeline]);

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
  const preview = inDraftOrder(previews?.[selected] ?? null, draft);
  const outcome = localIssue
    ? { tone: "bad" as const, title: "Not ready to publish", detail: localIssue }
    : check
      ? outcomeOf(check)
      : null;
  const refused = check?.verdict === "refused";
  const products = Object.entries(catalogue?.products ?? {});
  const current = selected === "product" ? product : null;

  const apply = (change: (screen: Screen) => Screen) => {
    setTexts((current) => ({ ...current, [selected]: pretty(change(published)) }));
  };
  const edit = (screen: Screen) => setTexts((current) => ({ ...current, [selected]: pretty(screen) }));
  const draftLayouts = Object.fromEntries(
    Object.entries(texts).map(([name, text]) => [name, parseScreen(text) ?? pipeline.layouts[name]]),
  );
  const fieldContext = {
    tokens: pipeline.reference.tokenOptions,
    screens: linkableScreens(draftLayouts),
    assets: knownAssets(pipeline.layouts, catalogue),
    catalogue,
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
              onClick={() => {
                setSelected(name);
                setSection(null);
              }}
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
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>Draft · {selected}</h2>
            <div className={styles.modes} role="group" aria-label="Editor">
              <button type="button" aria-pressed={mode === "cards"} onClick={() => setMode("cards")}>
                Sections
              </button>
              <button type="button" aria-pressed={mode === "json"} onClick={() => setMode("json")}>
                Edit as JSON
              </button>
            </div>
          </div>
          <div className={styles.examples}>
            {(mode === "cards" ? EXAMPLES.slice(0, 1) : EXAMPLES).map((example) => (
              <button
                key={example.label}
                type="button"
                className={styles.example}
                disabled={example.appliesTo ? !example.appliesTo(published) : false}
                onClick={() => apply(example.change)}
              >
                {mode === "cards" ? "Reset to published" : example.label}
              </button>
            ))}
          </div>
          {mode === "json" ? (
            <textarea
              className={styles.editor}
              aria-label={`${brand} ${selected} draft layout JSON`}
              spellCheck={false}
              value={texts[selected] ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                setTexts((current) => ({ ...current, [selected]: value }));
              }}
            />
          ) : draft ? (
            <SectionEditor
              key={selected}
              brand={brand}
              screen={draft}
              reference={pipeline.reference}
              published={pipeline.layouts}
              catalogue={catalogue}
              context={fieldContext}
              selected={section}
              onSelect={setSection}
              onChange={edit}
            />
          ) : (
            <div className={styles.notice} role="alert">
              <p>This screen&apos;s JSON has an error, so it can&apos;t be shown as sections.</p>
              <button type="button" className={styles.example} onClick={() => setMode("json")}>
                Fix it in JSON
              </button>{" "}
              <button type="button" className={styles.example} onClick={() => apply((screen) => screen)}>
                Reset to published
              </button>
            </div>
          )}
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
                <ScaledFrame highlight={mode === "cards" ? section : null}>
                  <div
                    className="strata-screen"
                    data-fit={preview.fit ?? "scroll"}
                    data-screen={selected}
                    style={preview.gap ? { gap: tokenVariable(preview.gap) } : undefined}
                  >
                    <PreviewSections screen={preview} />
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

      {mode === "json" && pipeline.reference ? (
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
function ScaledFrame({ children, highlight = null }: { children: ReactNode; highlight?: string | null }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ scale: number; height: number } | null>(null);
  const [box, setBox] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  // outline the selected section: union of its boxes, unscaled
  useEffect(() => {
    const page = inner.current;
    const frame = outer.current;
    const wrapper = highlight
      ? [...(page?.querySelectorAll<HTMLElement>("[data-section-id]") ?? [])].find((el) => el.dataset.sectionId === highlight)
      : null;
    const parts = wrapper ? [...wrapper.children] : [];
    if (!page || !frame || !parts.length || !size) {
      setBox(null);
      return;
    }
    const origin = page.getBoundingClientRect();
    const rects = parts.map((part) => part.getBoundingClientRect());
    const top = Math.min(...rects.map((r) => r.top));
    const left = Math.min(...rects.map((r) => r.left));
    const bottom = Math.max(...rects.map((r) => r.bottom));
    const right = Math.max(...rects.map((r) => r.right));
    const next = {
      top: (top - origin.top) / size.scale,
      left: (left - origin.left) / size.scale,
      width: (right - left) / size.scale,
      height: (bottom - top) / size.scale,
    };
    setBox(next);
    frame.scrollTo?.({ top: Math.max(0, next.top * size.scale - 24), behavior: "smooth" });
  }, [highlight, size, children]);

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
        {box ? (
          <div
            className={styles.highlight}
            aria-hidden
            style={{ top: box.top, left: box.left, width: box.width, height: box.height }}
          />
        ) : null}
      </div>
    </div>
  );
}

/** like ScreenRenderer, but wraps each section so the preview can outline it */
function PreviewSections({ screen }: { screen: Screen }) {
  return screen.sections.map((section) => {
    const Component = SECTIONS[section.type];
    if (!Component) return null;
    return (
      <div key={section.id} data-section-id={section.id} style={{ display: "contents" }}>
        <Component {...section.props} />
      </div>
    );
  });
}
