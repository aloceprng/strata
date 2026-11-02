# Design

Strata publishes tokens and screens, so the server decides what a page contains
as well as how it looks. This document covers how screens work and what is
left to build.

**Goal:** Clementine and Pomelo each have a home, product details and cart
screen, rendered from published layouts. Publishing a new layout changes a
page's structure with no frontend deploy. Only the home route exists today.

## Component layers

| Layer | Examples | Defined in | Changed by |
| --- | --- | --- | --- |
| Atoms | `Button`, `Input`, `Badge`, `Grid`, `Illustration`, `Price` | React | Code |
| Composites | `ProductCard`, `SectionHeader`, `SiteHeader`, `JourneyField`, `QuantityStepper`, `CartLineItem` | React | Code |
| Sections | `PromoHero`, `CategoryTiles`, `DealRow`, `ProductFigures`, `RouteList`, `ProductGallery`, `ProductSummary`, `ProductDetails`, `CartItems`, `OrderSummary` | React | Code |
| Screens | Each brand's home, product details and cart | `layout.json` | Published data |

A screen built from existing pieces is a data change. A new piece is code and a
frontend deploy.

## Layout format

```json
{
  "schemaVersion": 1,
  "screen": "home",
  "sections": [
    {
      "id": "seasonal-promo",
      "type": "Intro",
      "props": { "title": "Autumn harvest.", "gap": "space.stack.gap" }
    }
  ]
}
```

- Sections are an ordered list, with no nesting yet.
- Every section has a stable `id`, so a diff can tell a move from a removal.
- Style props take allowed options or semantic token names, never raw values.

## The component contract

`contracts/components.json` lists each section type, its props, and the
semantic tokens it reads. Python validates against it at publish. A frontend
test fails if an entry has no renderer or a renderer has no entry. It is not
imported at runtime, because Turbopack does not resolve files outside
`frontend/`.

## Token requirements

Brands do not need identical token sets. A brand needs the tokens used by the
components it renders.

| Tokens | Rule |
| --- | --- |
| Core | Read by shared atoms and composites; required on every brand |
| Section-specific | Listed per section; required only if the brand's layout uses it |
| Extra | Any brand may define its own |

In Figma, every variable in a collection exists in all of its modes, so a
single-brand token still appears on the other brands with an unused value.

## Versioning

One version holds a brand's tokens and screens, so `layouts` lives on
`TokenSet`. Fork, publish and immutability are reused, and a layout is always
checked against the tokens it shipped with.

Publishing writes `<brand>/<version>/screens/<screen>.json` and a `latest` copy.

Publish is refused for an unknown section type or schema version, a missing or
invalid prop, an unknown or missing token, or a duplicate section `id`.

| Change | Severity |
| --- | --- |
| Screen or section removed, or a section's type changed | Major |
| Screen or section added, or sections reordered | Minor |
| Prop or content changed | Patch |

## Planned: product and cart screens

Not built yet. The storage model already holds several screens per brand.

- **Routes:** `/brands/<brand>/<screen>` replaces the fixed `home` fetch.
- **Sample data:** six to eight fake products per brand. There is no catalogue
  or real product data.
- **Contract:** props gain number, list and action types.
- **Actions:** a layout can give a control an action from a fixed list:
  `addToCart`, `removeFromCart` and links between screens. Publish refuses any
  other action.
- **Cart:** add, change quantity, remove and updated totals, kept in the
  browser. The checkout button is shown disabled.

Both brands must sell things, so Pomelo's brief needs to make it a shop.

## Rendering

A server component fetches the screen from Django and maps each section to its
React component. The fetch uses the full Django URL, because the Next.js rewrite
serves browser requests. A section the renderer does not know is skipped and
logged, so an older frontend survives newer data.

## Build order

| Phase | Work | Finished when |
| --- | --- | --- |
| 1. Pipeline (done) | Validation, diff, publish, renderer, one simple section, `/pipeline` dry-run page | A published change appears without a deploy |
| 2. Clementine | Screen routes, sample data, actions, cart state, remaining atoms, composites and sections | Home, product and cart match Figma on desktop, and the cart works |
| 3. Pomelo | `ProductFigures`, `SpecNotes`, title rail, illustrations, its product and cart sections | Home, product and cart match Figma on desktop, and the cart works |
| 4. Kumquat | Sections for whatever the brand becomes | Three different pages from one renderer |
| 5. Demo | Authenticated publish from `/pipeline`, hosted site, README walkthrough | The idea lands in thirty seconds |

Kumquat's sector is decided just before phase 4. Token names do not depend on
it.

## Out of scope for now

Nested layouts, mobile, personalization, real product data, checkout, accounts,
payments, a server-side cart, and any forms or actions beyond the planned list.

Deferred until after the demo: the Celery build pipeline and SSE progress, the
Figma variable sync, and a drag editor.
