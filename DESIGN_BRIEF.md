# Design brief

Context for anyone helping design Strata's brands. For how the system works, see
[DESIGN.md](DESIGN.md). For token names and rules, see
[tokens/CONTRACT.md](tokens/CONTRACT.md).

## What Strata is

Strata is a portfolio project: one set of components and one renderer that power
several invented brands. Brands differ through data, not code.

- **Tokens** set how things look. Components read semantic tokens such as
  `colour.action.bg`, and each brand gives them different values.
- **Layouts** set what a page contains. A screen is JSON listing sections in order.
  Publishing a new layout changes the page with no frontend deploy.

Every publish is validated, versioned and graded as a patch, minor or major change.
Run the app and open `/pipeline` to see this working.

## What the design needs to prove

The demo succeeds if two brands look like different products built from the same
system. **Pomelo must differ from Clementine in structure, not only in colour.** If
it reads as a reskin, the case study loses its main proof.

Designers are the audience for the system as well as its users, so the case study
will show design decisions as well as finished screens.

## The brands

| Brand | Sector | Colours | Principle | Scope |
|---|---|---|---|---|
| Clementine | Grocery shop | Orange, yellow, blue | Not final; draft: "fill the basket fast" | Home, product details, cart |
| Pomelo | Furniture shop | Yellow, red, green | Not final; draft: "take your time over one good piece" | Home, product details, cart |

The draft principles are starting points. The owner should write the final ones.

| | Clementine | Pomelo |
|---|---|---|
| Buying style | Frequent, quick, many cheap items | Rare, slow, one considered purchase |
| Page feel | Dense, scannable | Spacious, image-led |
| Home | Deals, category tiles, product rows | Collection story, large pieces |
| Product page | Compact, quick to decide | Large gallery, long read, specs |
| Key details | Unit price, weight, deal badge | Dimensions, materials, finish, lead time |
| Adding to cart | Directly from `ProductCard` | From the product page, after choosing options |
| Cart | Many short lines, quantity changes matter | Few large items, delivery details prominent |

## Order of work

1. Write the Clementine and Pomelo principles.
2. Sketch all three Clementine pages at low fidelity, then cut unneeded parts.
3. Finalise Clementine's tokens, atoms, `SiteHeader`, `ProductCard` and `Price`.
4. Hand off `PromoHero` so it gets built before further design.
5. Finish Clementine's pages and choose 6–8 sample products.
6. Design Pomelo's three pages, sorting out product images early.

Current position: step 1.

## Parts to design

### Shared

| Part | Status | What to design |
|---|---|---|
| Button, IconButton | Built, placeholder styling | Variants, sizes, default, hover, focus, disabled |
| Badge | Built | Variants |
| Heading, Text | Built | Final type scale and tones |
| Card | Built | Elevation and padding |
| Field, Input, Select, Row | Built | Only if a page needs them |
| Price | New | Regular, discounted, and Clementine's per-unit price |
| Illustration | New | Sizes, crops and artwork |
| Grid | New | Columns and gutters |
| SectionHeader | New | Title with optional subtitle and link |
| SiteHeader | New | Logo, navigation, actions, cart icon with count |
| ProductCard | New | Image, name, price, badge; Clementine's needs an add control |

### Home

- **Clementine:** `PromoHero`, `CategoryTiles`, `DealRow`.
- **Pomelo:** `ProductFigures`, `SpecNotes`, title rail, illustrations.

### Product details

| Part | What to design |
|---|---|
| Product gallery | Main image, thumbnails if any |
| Product summary | Name, price, options, add-to-cart button |
| Option selector | Finish or fabric, including sold-out; mainly Pomelo |
| Product details | Description; Pomelo's dimensions, materials and care can use `SpecNotes` |
| Related products | Reuse `DealRow` and `ProductCard` |
| Added-to-cart feedback | Toast, drawer or header change |

### Cart

| Part | What to design |
|---|---|
| Cart line item | Image, name, option, price, remove |
| Quantity stepper | Plus and minus, minimum and disabled states |
| Order summary | Subtotal, delivery, total, checkout button shown disabled |
| Empty cart | Message and a link back to shopping |

### Assets

Logos, hero images, category images and 6–8 sample products per shop, with images.

## What every section handoff needs

1. **Fields:** the editable content, such as title, image or link.
2. **Variants:** the allowed options, such as image left or right. These become props
   in `contracts/components.json`.
3. **Tokens:** anything beyond the 67 core semantic tokens. New tokens may belong to
   one section or brand.
4. **Limits:** what happens with long text, or too few or too many items.

## Rules for designing

- Every value should map to a token, not a one-off number or colour.
- Style options must be named choices or tokens, because layouts cannot hold raw values.
- Sections sit in a flat, ordered list. Layouts cannot nest.
- Prefer a variant of an existing section to a new section, because each new section
  needs code and a deploy.
- A section may be shared by brands or used by one. Different structure matters more
  than maximum reuse.

## Out of scope

Mobile layouts, real product data, checkout, accounts, payments, a server-side cart,
personalization, and forms or actions beyond add to cart, remove from cart and links
between screens.

## Status and known gaps

- The design tool is Figma. Check with the owner which files exist, because this
  brief was written without seeing them.
- Colour primitives came from Figma. Spacing, radius, type and semantic values are
  first-pass and expected to change.
- `seed.py` still lists each brand's sector as `TBD`.
- Only the home route and the `Intro` section exist. Product and cart screens,
  actions, and sample data are planned in [DESIGN.md](DESIGN.md), not built.
- Figma variable sync is deferred, so token changes are entered in the token files
  or admin by hand.
