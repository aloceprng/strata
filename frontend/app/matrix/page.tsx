"use client";

import { useState } from "react";

import { BrandProvider, BrandStylesheet, useBrand } from "../components/BrandProvider";
import { COMPONENTS } from "./gallery";
import {
  ColourGrid,
  DefaultTokens,
  ValueGrid,
  elevationSample,
  radiusSample,
  scaleSample,
  typeSample,
} from "./tokens";
import styles from "./system.module.css";

const BRANDS = ["clementine", "kumquat", "pomelo"];

const COMPONENT_COUNT = 11;

export default function DesignSystem() {
  const [brand, setBrand] = useState(BRANDS[0]);

  return (
    <>
      {BRANDS.map((b) => (
        <BrandStylesheet key={b} brand={b} />
      ))}

      {}
      <BrandProvider brand={brand}>
        <div className={styles.page}>
          <Masthead />

          <Section
            id="primitives"
            title="Primitives"
            lead="Raw values, pointed to by semantics."
          >
            <Block label="colour">
              <ColourGrid layer="primitive" />
            </Block>
            <Block label="space">
              <ValueGrid layer="primitive" groups={["space"]} sample={scaleSample} />
            </Block>
            <Block label="radius · size">
              <ValueGrid layer="primitive" groups={["radius", "size"]} sample={radiusSample} />
            </Block>
            <Block label="type">
              <ValueGrid layer="primitive" groups={["font"]} sample={typeSample} />
            </Block>
            <Block label="duration">
              <ValueGrid layer="primitive" groups={["duration"]} />
            </Block>
          </Section>

          <Section
            id="semantics"
            title="Semantic tokens"
            lead="Defined values by function."
          >
            <Block label="colour">
              <ColourGrid layer="semantic" />
            </Block>
            <Block label="space">
              <ValueGrid layer="semantic" groups={["space"]} sample={scaleSample} />
            </Block>
            <Block label="radius · border · size">
              <ValueGrid
                layer="semantic"
                groups={["radius", "border", "size"]}
                sample={radiusSample}
              />
            </Block>
            <Block label="type">
              <ValueGrid layer="semantic" groups={["font"]} sample={typeSample} />
            </Block>
            <Block label="elevation · motion">
              <ValueGrid
                layer="semantic"
                groups={["elevation", "motion"]}
                sample={elevationSample}
              />
            </Block>
            <Block label="component defaults">
              <DefaultTokens />
            </Block>
          </Section>

          <Section
            id="components"
            title="Components"
            lead=""
          >
            {COMPONENTS.map((c) => (
              <article key={c.name} className={styles.component}>
                <header className={styles.componentHead}>
                  <h3>{c.name}</h3>
                  <p>{c.summary}</p>
                  <div className={styles.tokenTags}>
                    {c.tokens.map((t) => (
                      <code key={t}>{t}</code>
                    ))}
                  </div>
                </header>
                <div className={styles.componentBody}>{c.render()}</div>
              </article>
            ))}
          </Section>

          <div className={styles.bottomSpacer} />
        </div>
      </BrandProvider>

      <nav className={styles.switcher} aria-label="Design system">
        {BRANDS.map((b) => (
          <label key={b} className={styles.radio} data-active={b === brand || undefined}>
            <input
              type="radio"
              name="brand"
              value={b}
              checked={b === brand}
              onChange={() => setBrand(b)}
            />
            {b}
          </label>
        ))}
      </nav>
    </>
  );
}

function Masthead() {
  const { brand, bundle } = useBrand();
  return (
    <header className={styles.masthead}>
      <div>
        <p className={styles.eyebrow}>strata</p>
        <h1 className={styles.mastheadTitle}>{brand}</h1>
      </div>
      <dl className={styles.stats}>
        <div>
          <dt>tokens</dt>
          <dd>{bundle?.tokenCount ?? "—"}</dd>
        </div>
        <div>
          <dt>components</dt>
          <dd>{COMPONENT_COUNT}</dd>
        </div>
      </dl>
    </header>
  );
}

function Section({
  id,
  title,
  lead,
  children,
}: {
  id: string;
  title: string;
  lead: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={styles.section}>
      <div className={styles.sectionHead}>
        <h2>{title}</h2>
        <p className={styles.lead}>{lead}</p>
      </div>
      {children}
    </section>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.block}>
      <code className={styles.blockLabel}>{label}</code>
      {children}
    </div>
  );
}
