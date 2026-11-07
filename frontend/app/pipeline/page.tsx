"use client";

import { useEffect, useState } from "react";

import { BrandProvider, BrandStylesheet } from "../components/BrandProvider";
import { ScreenRenderer, type Screen } from "../sections/ScreenRenderer";
import type { Catalogue } from "../store/catalogue";
import { StoreProvider } from "../store/StoreProvider";
import {
  EXAMPLES,
  outcomeOf,
  parseDraft,
  type Check,
  type Layouts,
  type Pipeline,
} from "./model";
import styles from "./pipeline.module.css";
import { Reference } from "./Reference";

const BRANDS = ["clementine", "pomelo"];
const CHECK_DELAY_MS = 250;

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
              Edit a screen and see what publishing it would do. These are the real publish
              checks, run as a dry run: nothing here is saved.
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
  const [text, setText] = useState("");
  const [check, setCheck] = useState<Check | null>(null);
  const [preview, setPreview] = useState<Screen | null>(null);
  const [catalogue, setCatalogue] = useState<Catalogue | undefined>(undefined);

  // Layouts name products by id, so the preview needs the published catalogue to show them.
  useEffect(() => {
    let cancelled = false;
    fetch(`/artifacts/${brand}/latest/catalogue.json`)
      .then((response) => (response.ok ? response.json() : undefined))
      .catch(() => undefined)
      .then((loaded: Catalogue | undefined) => {
        if (!cancelled) setCatalogue(loaded);
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
        setText(JSON.stringify(loaded.layouts, null, 2));
      })
      .catch((error: Error) => {
        if (error.name !== "AbortError") setLoadError(error.message);
      });
    return () => controller.abort();
  }, [brand]);

  useEffect(() => {
    if (!text) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const draft = parseDraft(text);
      if (!draft.ok) {
        setCheck({ verdict: "refused", error: draft.error, changes: [] });
        return;
      }
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
          if (result.verdict !== "refused") setPreview(draft.layouts.home ?? null);
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
  }, [brand, text]);

  if (loadError) {
    return (
      <p className={styles.notice} role="alert">
        Could not load {brand}: {loadError}. Is Django running on port 8000?
      </p>
    );
  }
  if (!pipeline) return <p className={styles.notice}>Loading {brand}…</p>;

  const apply = (change: (layouts: Layouts) => Layouts) => {
    setText(JSON.stringify(change(pipeline.layouts), null, 2));
  };
  const outcome = check ? outcomeOf(check) : null;
  const refused = check?.verdict === "refused";

  return (
    <>
      <section className={styles.verdict} data-tone={outcome?.tone} aria-live="polite">
        <strong>{outcome?.title ?? "Checking…"}</strong>
        <span>{outcome?.detail}</span>
      </section>

      <main className={styles.grid}>
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Draft layout</h2>
          <div className={styles.examples}>
            {EXAMPLES.map((example) => (
              <button
                key={example.label}
                type="button"
                className={styles.example}
                onClick={() => apply(example.change)}
              >
                {example.label}
              </button>
            ))}
          </div>
          <textarea
            className={styles.editor}
            aria-label={`${brand} draft layout JSON`}
            spellCheck={false}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </section>

        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>
            Preview{refused ? " · last valid draft" : ""}
          </h2>
          <BrandProvider brand={brand}>
            <StoreProvider brand={brand} catalogue={catalogue}>
              <div className={styles.preview}>
                {preview ? (
                  <ScreenRenderer screen={preview} />
                ) : (
                  <p className={styles.empty}>No home screen in this draft.</p>
                )}
              </div>
            </StoreProvider>
          </BrandProvider>
        </section>

        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Changes against published</h2>
          {check?.changes.length ? (
            <ul className={styles.list}>
              {check.changes.map((change) => (
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
          reference={pipeline.reference}
          inUse={(preview ?? pipeline.layouts.home)?.sections.map((s) => s.type) ?? []}
        />
      ) : null}
    </>
  );
}
