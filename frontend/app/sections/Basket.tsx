"use client";

import { useState } from "react";

import { Checkbox, Icon, LinkTo, OfferTag, QuantityStepper, SummaryRow } from "../components/commerce";
import { Button, Input } from "../components/primitives";
import type { PricedLine } from "../store/catalogue";
import { useStore } from "../store/StoreProvider";

export type BasketProps = {
  /** compact: many short lines beside a totals panel. detailed: few large lines, totals beneath. */
  layout: "compact" | "detailed";
  summaryTitle?: string;
  checkoutLabel: string;
  extrasTitle?: string;
  promo?: boolean;
  emptyTitle: string;
  emptyLinkLabel?: string;
  emptyLink?: string;
};

type Store = NonNullable<ReturnType<typeof useStore>>;

export function Basket(props: BasketProps) {
  const store = useStore();
  if (!store) return null;
  if (!store.totals.lines.length) {
    return (
      <section className="strata-basket-empty">
        <p>{props.emptyTitle}</p>
        {props.emptyLinkLabel ? (
          <LinkTo className="strata-button" data-variant="primary" data-size="md" link={props.emptyLink}>
            {props.emptyLinkLabel}
          </LinkTo>
        ) : null}
      </section>
    );
  }
  return props.layout === "compact" ? <CompactBasket store={store} {...props} /> : <DetailedBasket store={store} {...props} />;
}

function CompactBasket({ store, summaryTitle, checkoutLabel }: BasketProps & { store: Store }) {
  const { totals, money } = store;
  return (
    <section className="strata-basket" data-layout="compact">
      <ul className="strata-cart-lines">
        {totals.lines.map((line) => (
          <li key={line.key} className="strata-cart-line" data-layout="compact">
            <LinkTo className="strata-cart-thumb" link={`product/${line.product}`} tabIndex={-1} aria-hidden="true">
              <img src={line.item.image} alt="" />
            </LinkTo>
            <div className="strata-cart-info">
              <div className="strata-cart-name-row">
                <LinkTo className="strata-cart-name" link={`product/${line.product}`}>
                  {line.item.name}
                </LinkTo>
                {line.item.offer && line.item.tag ? <OfferTag tone={line.item.tag.tone}>{line.item.tag.label}</OfferTag> : null}
              </div>
              <span className="strata-cart-detail">
                {line.quantity} × {money(Math.round(line.item.price * 100))} {line.item.per ?? line.item.unit ?? ""}
              </span>
            </div>
            <LineStepper store={store} line={line} />
            <span className="strata-cart-price">{money(line.charged)}</span>
            <button type="button" className="strata-cart-remove" aria-label={`Remove ${line.item.name}`} onClick={() => store.remove(line.key)}>
              <Icon name="close" />
            </button>
          </li>
        ))}
      </ul>
      <aside className="strata-order-summary" aria-label={summaryTitle ?? "Order summary"}>
        {summaryTitle ? <h2>{summaryTitle}</h2> : null}
        <Totals store={store} />
        {totals.offers > 0 ? (
          <p className="strata-note">
            <Icon name="check" />
            You’re saving {money(totals.offers)} on this order
          </p>
        ) : null}
        <Checkout label={checkoutLabel} />
      </aside>
    </section>
  );
}

function DetailedBasket({ store, checkoutLabel, extrasTitle, promo }: BasketProps & { store: Store }) {
  const { totals, money, catalogue, cart } = store;
  const extras = catalogue.extras ?? [];
  return (
    <section className="strata-basket" data-layout="detailed">
      <table className="strata-cart-table">
        <thead>
          <tr>
            <th scope="col">Product</th>
            <th scope="col">Quantity</th>
            <th scope="col">Price</th>
          </tr>
        </thead>
        <tbody>
          {totals.lines.map((line) => (
            <tr key={line.key} className="strata-cart-line" data-layout="detailed">
              <td>
                <div className="strata-cart-product">
                  <LinkTo className="strata-cart-thumb" link={`product/${line.product}`} tabIndex={-1} aria-hidden="true">
                    <img src={line.item.image} alt="" />
                  </LinkTo>
                  <div className="strata-cart-info">
                    <LinkTo className="strata-cart-name" link={`product/${line.product}`}>
                      {line.item.name}
                    </LinkTo>
                    {line.option ? (
                      <div className="strata-cart-option">
                        <span>{line.item.options?.label ?? "Option"}:</span>
                        <span>{line.option}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </td>
              <td>
                <LineStepper store={store} line={line} />
              </td>
              <td>
                <div className="strata-cart-price-cell">
                  <span className="strata-cart-price">{money(line.charged)}</span>
                  <button
                    type="button"
                    className="strata-cart-remove-text"
                    aria-label={`Remove ${line.item.name}`}
                    onClick={() => store.remove(line.key)}
                  >
                    Remove
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="strata-basket-lower">
        <div className="strata-order-summary" data-layout="detailed">
          {extras.length ? (
            <fieldset className="strata-extras">
              {extrasTitle ? <legend>{extrasTitle}</legend> : null}
              {extras.map((extra) => (
                <div key={extra.id} className="strata-extra">
                  <Checkbox checked={cart.extras.includes(extra.id)} onChange={() => store.toggleExtra(extra.id)}>
                    <span className="strata-extra-label">{extra.label}</span>
                    {extra.note ? <span className="strata-extra-note">{extra.note}</span> : null}
                  </Checkbox>
                  <span className="strata-extra-price">{money(Math.round(extra.price * 100))}</span>
                </div>
              ))}
            </fieldset>
          ) : null}
          {promo ? <PromoCode /> : null}
          <Totals store={store} />
          <Checkout label={checkoutLabel} />
        </div>
      </div>
    </section>
  );
}

function LineStepper({ store, line }: { store: Store; line: PricedLine }) {
  return (
    <QuantityStepper
      value={line.quantity}
      min={1}
      label={line.item.name}
      onChange={(quantity) => store.setQuantity(line.key, quantity)}
    />
  );
}

function Totals({ store }: { store: Store }) {
  const { totals, money, catalogue } = store;
  return (
    <dl className="strata-summary-rows">
      <SummaryRow label="Subtotal" value={money(totals.subtotal)} />
      {totals.offers > 0 ? <SummaryRow label="Offers" value={money(-totals.offers)} kind="saving" /> : null}
      {catalogue.extras?.length ? <SummaryRow label="Extras" value={money(totals.extras)} /> : null}
      <SummaryRow label="Delivery" value={totals.delivery ? money(totals.delivery) : "Free"} />
      <SummaryRow label="Total" value={money(totals.total)} kind="total" />
    </dl>
  );
}

/** Promo codes are out of scope: the field takes input but applies nothing. */
function PromoCode() {
  return (
    <form className="strata-promo" onSubmit={(event) => event.preventDefault()}>
      <Input placeholder="Promo code" aria-label="Promo code" />
      <Button variant="secondary" type="submit">
        Apply
      </Button>
    </form>
  );
}

/** Checkout is out of scope, so the button explains instead of acting. */
function Checkout({ label }: { label: string }) {
  const [asked, setAsked] = useState(false);
  return (
    <div className="strata-checkout">
      <Button variant="primary" aria-disabled="true" aria-describedby="checkout-note" onClick={() => setAsked(true)}>
        {label}
      </Button>
      <p id="checkout-note" className="strata-checkout-note" hidden={!asked}>
        Checkout isn’t part of this demo. Your basket stays in this browser.
      </p>
    </div>
  );
}
