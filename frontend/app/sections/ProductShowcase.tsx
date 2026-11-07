"use client";

import { useState } from "react";

import { AccordionRow, ColourOption, QuantityStepper, SaveButton } from "../components/commerce";
import { Button } from "../components/primitives";
import { useStore } from "../store/StoreProvider";
import { useAdded } from "./useAdded";

export type ProductShowcaseProps = {
  optionsLabel?: string;
  specsLabel?: string;
  addLabel?: string;
  addedLabel?: string;
};

/** Pomelo's product page: options to one side, two large views, a long read with the specs. */
export function ProductShowcase({
  optionsLabel = "Other colours",
  specsLabel = "Parameters",
  addLabel = "Add to basket",
  addedLabel = "Added to basket",
}: ProductShowcaseProps) {
  const store = useStore();
  const id = store?.current;
  const product = id ? store.product(id) : undefined;
  const [choice, setChoice] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [added, flash] = useAdded();
  if (!store || !id || !product) return null;

  const options = product.options;
  const selected = options?.choices[choice];

  return (
    <section className="strata-product-showcase">
      <div className="strata-showcase-options">
        {options ? (
          <>
            <p className="strata-showcase-label">{optionsLabel}</p>
            <div className="strata-colour-options" role="radiogroup" aria-label={options.label}>
              {options.choices.map((option, index) => (
                <ColourOption
                  key={option.name}
                  name={option.name}
                  swatch={option.swatch}
                  selected={index === choice}
                  onSelect={() => setChoice(index)}
                />
              ))}
            </div>
            <p className="strata-showcase-caption">{selected?.name}</p>
          </>
        ) : null}
      </div>

      <div className="strata-showcase-gallery">
        <div className="strata-showcase-view" data-view="front">
          <img src={product.image} alt={product.name} />
        </div>
        <div className="strata-showcase-view" data-view="detail">
          <img src={product.image} alt="" />
        </div>
      </div>

      <div className="strata-showcase-details">
        <div className="strata-showcase-title">
          <h1 className="strata-display-title">{product.name}</h1>
          <p className="strata-showcase-price">
            <span className="strata-price-amount">{store.money(Math.round(product.price * 100))}</span>
            {product.delivery ? <span>{product.delivery}</span> : null}
          </p>
          {product.description ? <p className="strata-showcase-description">{product.description}</p> : null}
        </div>

        {product.specs?.length ? (
          <dl className="strata-spec-table">
            <dt className="strata-spec-heading">{specsLabel}</dt>
            {product.specs.map((spec) => (
              <div key={spec.label} className="strata-spec-row">
                <dt>{spec.label}</dt>
                <dd>{spec.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        <div className="strata-showcase-actions">
          <QuantityStepper value={quantity} onChange={setQuantity} label={product.name} surface="plain" />
          <div className="strata-showcase-buy">
            <Button
              variant="primary"
              onClick={() => {
                store.add(id, quantity, selected?.name);
                flash();
              }}
            >
              {added ? addedLabel : addLabel}
            </Button>
            <SaveButton product={id} label={product.name} />
          </div>
        </div>

        {product.details?.length ? (
          <div className="strata-accordion">
            {product.details.map((detail) => (
              <AccordionRow key={detail.title} title={detail.title} body={detail.body} />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
