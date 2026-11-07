"use client";

import { useState } from "react";

import { AccordionRow, Icon, OfferTag, QuantityStepper } from "../components/commerce";
import { Button } from "../components/primitives";
import { linePrice } from "../store/catalogue";
import { useStore } from "../store/StoreProvider";
import { useAdded } from "./useAdded";

export type ProductOverviewProps = { addLabel?: string; addedLabel?: string };

/** Clementine's product page: decide quickly, with the offer and the delivery slot in view. */
export function ProductOverview({ addLabel = "Add to basket", addedLabel = "Added to basket" }: ProductOverviewProps) {
  const store = useStore();
  const [quantity, setQuantity] = useState(1);
  const [added, flash] = useAdded();
  const id = store?.current;
  const product = id ? store.product(id) : undefined;
  if (!store || !id || !product) return null;

  const cost = store.money(linePrice(product, quantity).charged);
  const unitLine = [product.unit, product.unitPrice].filter(Boolean).join(" · ");

  return (
    <section className="strata-product-overview">
      <div className="strata-product-media">
        <img src={product.image} alt={product.name} />
        {product.tag ? (
          <span className="strata-product-media-tag">
            <OfferTag tone={product.tag.tone}>{product.tag.label}</OfferTag>
          </span>
        ) : null}
      </div>
      <div className="strata-product-info">
        {product.badges?.length ? (
          <div className="strata-product-badges">
            {product.badges.map((badge) => (
              <OfferTag key={badge.label} tone={badge.tone ?? "info"}>
                {badge.label}
              </OfferTag>
            ))}
          </div>
        ) : null}
        <div className="strata-product-title">
          <h1>{product.name}</h1>
          {product.summary ? <p>{product.summary}</p> : null}
        </div>
        <p className="strata-price-lockup">
          <span className="strata-price-lockup-amount">{store.money(Math.round(product.price * 100))}</span>
          {unitLine ? <span className="strata-price-unit">{unitLine}</span> : null}
        </p>
        <div className="strata-product-buy">
          <QuantityStepper value={quantity} onChange={setQuantity} label={product.name} />
          <Button
            variant="primary"
            onClick={() => {
              store.add(id, quantity);
              flash();
            }}
          >
            {added ? addedLabel : `${addLabel} · ${cost}`}
          </Button>
        </div>
        {product.delivery ? (
          <p className="strata-note">
            <Icon name="clock" />
            {product.delivery}
          </p>
        ) : null}
        {product.details?.length ? (
          <div className="strata-accordion">
            {product.details.map((detail, index) => (
              <AccordionRow key={detail.title} title={detail.title} body={detail.body} defaultOpen={index === 0} />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
