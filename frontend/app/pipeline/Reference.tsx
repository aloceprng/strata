"use client";

import { useState } from "react";

import { sampleProps, type PropRule, type Reference as ReferenceData } from "./model";
import styles from "./pipeline.module.css";

const ASSET_RULE = "a path like /products/brand/name.png — lowercase, hyphens, .png .jpg .webp or .svg";

export function Reference({ reference, inUse }: { reference: ReferenceData; inUse: string[] }) {
  const types = Object.keys(reference.sections);
  const [picked, setPicked] = useState(() => types.find((t) => inUse.includes(t)) ?? types[0]);
  const [copied, setCopied] = useState(false);
  const section = reference.sections[picked];

  const snippet = JSON.stringify(
    { id: kebab(picked), type: picked, props: sampleProps(section.props, reference.tokenOptions) },
    null,
    2,
  );

  const copy = () => {
    navigator.clipboard?.writeText(snippet).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      },
      () => undefined,
    );
  };

  return (
    <section className={`${styles.panel} ${styles.reference}`} aria-labelledby="reference-title">
      <h2 id="reference-title" className={styles.panelTitle}>
        Key reference
      </h2>
      <p className={styles.refLead}>
        Every key the publish check accepts. Anything not listed here is refused. <b>*</b> = required.
      </p>

      <div className={styles.refShape}>
        <div>
          <h3 className={styles.refHeading}>Screen</h3>
          <dl className={styles.refKeys}>
            <dt><code>schemaVersion</code>*</dt>
            <dd><code>{reference.schemaVersion}</code></dd>
            <dt><code>screen</code>*</dt>
            <dd>same as the screen&apos;s key, e.g. <code>&quot;home&quot;</code></dd>
            <dt><code>fit</code></dt>
            <dd><Values values={reference.fits} /> <span className={styles.refNote}>default scroll</span></dd>
            <dt><code>sections</code>*</dt>
            <dd>list of sections, top to bottom</dd>
          </dl>
        </div>
        <div>
          <h3 className={styles.refHeading}>Section</h3>
          <dl className={styles.refKeys}>
            <dt><code>id</code>*</dt>
            <dd>any text, unique on the screen. Renaming it counts as remove + add (major)</dd>
            <dt><code>type</code>*</dt>
            <dd><Values values={types} /></dd>
            <dt><code>props</code></dt>
            <dd>depends on the type — pick one below</dd>
          </dl>
        </div>
      </div>

      <div className={styles.examples} role="tablist" aria-label="Section type">
        {types.map((type) => (
          <button
            key={type}
            type="button"
            role="tab"
            aria-selected={type === picked}
            className={styles.example}
            onClick={() => setPicked(type)}
          >
            {type}
            {inUse.includes(type) ? <span className={styles.refDot} aria-label="used in this draft" /> : null}
          </button>
        ))}
      </div>

      <div className={styles.refBody}>
        <table className={styles.refTable}>
          <thead>
            <tr>
              <th>prop</th>
              <th>takes</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(section.props).map(([name, rule]) => (
              <PropRows key={name} name={name} rule={rule} tokens={reference.tokenOptions} depth={0} />
            ))}
          </tbody>
        </table>
        <div className={styles.refSnippet}>
          <div className={styles.refSnippetHead}>
            <span>Minimal {picked}</span>
            <button type="button" className={styles.example} onClick={copy}>
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <pre>{snippet}</pre>
          <p className={styles.refNote}>Paste into <code>sections</code>, then add optional props from the table.</p>
        </div>
      </div>
    </section>
  );
}

function PropRows({
  name,
  rule,
  tokens,
  depth,
}: {
  name: string;
  rule: PropRule;
  tokens: Record<string, string[]>;
  depth: number;
}) {
  return (
    <>
      <tr>
        <td style={{ paddingLeft: 10 + depth * 18 }}>
          {depth ? <span className={styles.refNote}>└ </span> : null}
          <code>{name}</code>
          {rule.required ? "*" : null}
        </td>
        <td>
          <Takes rule={rule} tokens={tokens} />
        </td>
      </tr>
      {rule.type === "list"
        ? Object.entries(rule.items ?? {}).map(([child, childRule]) => (
            <PropRows key={child} name={child} rule={childRule} tokens={tokens} depth={depth + 1} />
          ))
        : null}
    </>
  );
}

function Takes({ rule, tokens }: { rule: PropRule; tokens: Record<string, string[]> }) {
  switch (rule.type) {
    case "enum":
      return <Values values={rule.values ?? []} />;
    case "boolean":
      return <Values values={["true", "false"]} bare />;
    case "number":
      return <span>a number{range(rule)}</span>;
    case "asset":
      return <span>{ASSET_RULE}</span>;
    case "token": {
      const options = tokens[rule.group ?? ""] ?? [];
      return options.length ? <Values values={options} /> : <span>a <code>{rule.group}.*</code> token</span>;
    }
    case "list":
      return <span>a list{range(rule, "items")}, each an object with the keys below</span>;
    case "products":
      return <span>a list of catalogue product ids{range(rule, "products")}</span>;
    case "link":
      return <span>a screen name, or <code>product/&lt;id&gt;</code></span>;
    default:
      return <span>any text</span>;
  }
}

function Values({ values, bare }: { values: string[]; bare?: boolean }) {
  return (
    <span className={styles.refValues}>
      {values.map((v) => (
        <code key={v}>{bare ? v : `"${v}"`}</code>
      ))}
    </span>
  );
}

function range(rule: PropRule, noun = "") {
  const unit = noun ? ` ${noun}` : "";
  if (rule.min !== undefined && rule.max !== undefined) return `, ${rule.min}–${rule.max}${unit}`;
  if (rule.max !== undefined) return `, up to ${rule.max}${unit}`;
  if (rule.min !== undefined) return `, at least ${rule.min}${unit}`;
  return "";
}

function kebab(type: string) {
  return type.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}
