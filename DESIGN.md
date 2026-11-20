# Design

Strata publishes tokens and screens, so the server decides what a page contains
as well as how it looks. This document covers how screens work and what is
left to build.

**Goal:** Clementine and Pomelo each have a home, product details and cart
screen, rendered from published layouts. Publishing a new layout changes a
page's structure with no frontend deploy. Both brands now have home, shop,
product and basket screens.

## Component layers

| Layer | Examples | Defined in | Changed by |
| --- | --- | --- | --- |
| Atoms | `Button`, `Input`, `Badge`, `Grid`, `Illustration`, `Price` | React | Code |
| Composites | `ProductCard`, `SectionHeader`, `SiteHeader`, `JourneyField`, `QuantityStepper`, `CartLineItem` | React | Code |
| Sections | `SiteHeader`, `Intro`, `PromoHero`, `WordmarkHero`, `PageTitle`, `Breadcrumb`, `ProductRow`, `CategoryCarousel`, `ProductGrid`, `CatalogueGrid`, `CatalogueRail`, `ProductFigures`, `ProductOverview`, `ProductShowcase`, `Basket`, `SiteFooter` | React | Code |
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

## Screens, catalogue and cart

Each brand publishes four screens: `home`, `shop`, `product` and `basket`.

- **Routes:** `/brands/<brand>` is home, `/brands/<brand>/<screen>` any other
  screen, and `/brands/<brand>/products/<id>` the product screen. `product` is a
  template rendered once per catalogue product; an unknown id is a 404.
- **Catalogue:** `catalogue/<brand>.catalogue.json` holds the sample products,
  currency, delivery fee, Pomelo's extras and the starting basket. It is
  versioned with tokens and layouts and published as `catalogue.json`, so a card,
  a product page and a basket line read one record. Removing a product is major,
  adding one minor, any other change a patch.
- **Contract types:** `products` (a list of catalogue ids) and `link` (a screen
  name or `product/<id>`). Publish refuses an id the catalogue lacks and a link to
  a screen the version lacks. A section marked `"context": "product"` may only sit
  on the product screen. A screen may set `gap` to a `space.*` token.
- **Copy templates:** layout text may use `{units}`, `{lines}` and `{products}`,
  e.g. `"Basket ({lines})"`, filled from the live basket or the listing.
- **Cart:** add, change quantity, remove, extras and saved items, kept per brand
  in `localStorage` and seeded from the catalogue. Totals apply the catalogue's
  multibuy and buy-X-get-Y offers, and reproduce the Figma totals exactly.
  Checkout, promo codes and the newsletter render but do nothing.

`python manage.py seed --update` publishes the source files as a new version
when they differ from the latest one.

## Rendering

A server component fetches the screen from Django and maps each section to its
React component. The fetch uses the full Django URL, because the Next.js rewrite
serves browser requests. A section the renderer does not know is skipped and
logged, so an older frontend survives newer data.

## Build order

| Phase | Work | Finished when |
| --- | --- | --- |
| 1. Pipeline (done) | Validation, diff, publish, renderer, one simple section, `/pipeline` dry-run page | A published change appears without a deploy |
| 2. Clementine (done) | Screen routes, sample data, actions, cart state, remaining atoms, composites and sections | Home, product and cart match Figma on desktop, and the cart works |
| 3. Pomelo (done) | Wordmark hero, catalogue grid and rail, showcase, detailed basket, footer | Home, product and cart match Figma on desktop, and the cart works |
| 4. Demo | Authenticated publish from `/pipeline`, hosted site, README walkthrough | The idea lands in thirty seconds |

Clementine is a grocery shop and Pomelo a furniture shop. See [DESIGN_BRIEF.md](DESIGN_BRIEF.md) for the design work.

## Layout editor

Decided 2026-11-12 after a test of `/pipeline`. Built 2026-11-15; the re-test
below has not been run yet.

**Why.** Non-technical testers, standing in for designers who don't write code,
were asked to edit a layout in the JSON editor. They got stuck on:

- JSON syntax itself.
- The keys: `type`, `props` and token names meant nothing to them.
- Adding a section such as a header: nothing showed how.
- Picturing where a section would land without being able to move it there.
- They said fixing it in Figma and re-exporting would be easier.

**What replaces the JSON editor.** A section list editor on `/pipeline`. The
preview, the diff and the major/minor/patch verdict stay as they are.

| Finding | Editor behaviour |
| --- | --- |
| JSON syntax | No JSON. Each section is a card in a list; its props are form fields |
| Confusing keys | Plain labels: "Promo banner", not `PromoHero`; "Title", not `props.title` |
| Can't add a section | An "Add section" menu with a thumbnail per section type, limited to types the brand's tokens support and, for `"context": "product"` types (`ProductOverview`, `ProductShowcase`), to the product screen |
| Can't picture placement | Drag a card to reorder, preview updating as you drag; selecting a card highlights its section in the preview |
| (keyboard access) | Move up / move down buttons on each card do everything dragging does |

Each card also has a delete button, with an undo.

As built:

- Dragging uses pointer events, not HTML drag and drop, so it also works by
  touch. The preview shows a pure reorder at once instead of waiting for the
  check.
- The JSON editor is still there behind "Edit as JSON", on the same draft. The
  example edits and the key reference appear only in that mode; the cards keep
  "Reset to published". A screen whose JSON is broken can't be shown as cards
  until it is fixed or reset.
- Empty required fields, out-of-range numbers and bad image paths show on the
  card and turn the verdict to "Not ready to publish" before the server is asked.
- `GET /api/brands/<brand>/pipeline` returns `reference.supported`, the section
  types the brand has every token for, which the add menu uses.
- Screen-level settings (`fit`, `gap`) are editable only as JSON.

**Fields come from the contract.** `contracts/components.json` already types every
prop, so the form is generated from it:

| Prop type | Field |
| --- | --- |
| `string` | Text input; `required` props can't be left empty |
| `enum` | Select with its `values` |
| `token` | Select of the brand's tokens in that `group`, shown by plain name |
| `number` | Number input, bounded by the rule's `min`/`max` |
| `boolean` | Checkbox |
| `asset` | Select of every image the brand's layouts and catalogue already use, with a thumbnail, plus "Custom path…" for a typed path. No uploads |
| `link` | Select of the version's screens by plain name ("Shop", "Basket"), plus "A product…", which opens the product picker and stores `product/<id>` |
| `products` | Product picker: search the version's catalogue by name and image, add, remove and reorder; stores catalogue ids |
| `list` | Repeatable rows (see below) |

Link and product pickers offer only what the version holds, so the two
catalogue refusals at publish (an unknown product id, a link to a missing
screen) can't be reached from the editor.

**List props.** Every `list` in the contract is a list of objects with its own
typed fields, for example `SiteHeader.links`: required, 1 to 8 items, each a
label, a link and an active flag. Each row is a small sub-form built from the
`items` rules with the same field table. Rows have add, delete and move up/down
buttons, no drag. Add is disabled at `max` and delete at `min`, and the reason
is shown beside the button rather than only in the verdict.

**New sections start filled.** A section added from the menu is a copy of an
instance of that type from the brand's current version, if one exists, so a
new header already has the brand's links. Otherwise it gets `sampleProps` from
`frontend/app/pipeline/model.ts`, with placeholder text and assets the card
flags for replacement. Either way it validates the moment it lands.

Display names live in the contract: a `label` per section type, per prop and
per list item field (for example `"PromoHero": {"label": "Promo banner"}`),
not hard-coded in the frontend. Section `id`s are generated on
add and never shown, so the diff can still tell a move from a removal.

Because the editor offers only valid types, props and tokens, an invalid layout
can only come from an empty required field or a mistyped custom image path, and
the card flags both; publish validation stays as the backstop.

**Options considered.**

- A. Section list editor with drag to reorder. **Chosen**: it answers every
  finding. Estimated three to five days: 16 thumbnails, list sub-forms, link
  and product pickers, drag with a live preview, keyboard parity and preview
  highlighting.
- B. Free drag-and-drop canvas onto the preview. Rejected: it implies free
  placement, but a screen is an ordered list with no nesting; it needs a second
  keyboard path anyway; it needs all of A's forms and pickers on top of the
  canvas.
- C. Layouts edited in Figma and exported by a plugin. Deferred: closest to
  "I'd rather fix it in Figma", but it revives the Figma sync cut from scope and
  is a week or more.

**Done when.** A tester who has never seen Strata can add a header, move the
promo banner to the top and change its title without help, using the keyboard
only or the mouse only. Re-test with the original tasks and one or two new
people, and record what still trips them up.

## Out of scope for now

Nested layouts, mobile, personalization, real product data, checkout, accounts,
payments, a server-side cart, and any forms or actions beyond the planned list.

Deferred until after the demo: the Celery build pipeline and SSE progress, the
Figma variable sync, and a free-form drag canvas (the section list editor
above replaces it).
