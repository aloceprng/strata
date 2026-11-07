# The token contract

**Semantic tokens are a contract.** A brand needs every token read by the
components it renders. Shared components read the 67 core keys below, so every
brand defines those — different values, identical names. A component asks for
`--colour-action-bg`; a brand that omits it renders that component wrong on that
brand alone. `test_every_brand_defines_the_core_semantic_tokens` asserts this
against `REQUIRED_SEMANTIC` in `backend/tests/test_resolver.py`, so a missing
key fails the suite rather than the page. Change that list and this file
together.

**Brands may have more.** A section lists the tokens it reads in
`contracts/components.json`, and publish refuses a layout whose brand lacks
them. A section used by one brand needs its tokens on that brand alone, and any
brand may define extra tokens of its own. See [DESIGN.md](../DESIGN.md).

**Primitives are free.** Clementine and Pomelo share `colour.brand-1.*` 
and `colour.red.*`. The only rule the resolver enforces is direction: a primitive 
may never reference a semantic token, or the two tiers stop being tiers.

One naming rule the resolver does not enforce: a primitive group never reuses a
word from the semantic tier — `primary`, `secondary`, `action`, `surface`,
`text`, `border`, `focus`, `status`, `danger`, `warning` — and `success`, which
no brand defines yet but is the obvious next status key. Name
primitives by hue (`green`, `teal`, `amber`) or by slot (`brand-1`).

Components read semantic tokens only. Primitives are emitted under a `--p-`
prefix precisely so a component reaching into the lower stratum is visible in
devtools instead of invisible.

## Semantic — core

### Colour — 22

| Token | Figma type | Purpose |
| --- | --- | --- |
| `colour.surface.page` | COLOR | Page background |
| `colour.surface.raised` | COLOR | Card or panel above the page |
| `colour.surface.sunken` | COLOR | Input fills, wells |
| `colour.text.primary` | COLOR | Body and headings |
| `colour.text.secondary` | COLOR | Supporting text, field labels |
| `colour.text.muted` | COLOR | Captions, placeholders |
| `colour.text.inverse` | COLOR | Text on a filled action surface |
| `colour.text.accent` | COLOR | Numbers, prices, captions and inline links |
| `colour.action.bg` | COLOR | Primary button fill |
| `colour.action.bg-hover` | COLOR | Primary button hover |
| `colour.action.fg` | COLOR | Primary button label |
| `colour.action.border` | COLOR | Primary button edge |
| `colour.secondary.bg` | COLOR | Secondary button fill |
| `colour.secondary.bg-hover` | COLOR | Secondary button hover |
| `colour.secondary.fg` | COLOR | Secondary button label |
| `colour.secondary.border` | COLOR | Secondary button edge |
| `colour.border.subtle` | COLOR | Card edges, dividers |
| `colour.border.default` | COLOR | Input edges |
| `colour.border.strong` | COLOR | Emphasis, selected state |
| `colour.focus.ring` | COLOR | Focus outline |
| `colour.status.danger` | COLOR | Errors, destructive actions |
| `colour.status.warning` | COLOR | Warnings |

### Space — 11

| Token | Figma type | Purpose |
| --- | --- | --- |
| `space.page.padding-x` | FLOAT | Screen side margin (Clementine 56, Pomelo 48) |
| `space.page.padding-y` | FLOAT | Screen top and bottom margin (Clementine 24, Pomelo 56) |
| `space.section.gap` | FLOAT | Gap between a screen's sections (Clementine 32, Pomelo 96) |
| `space.control.padding-x` | FLOAT | Button and input horizontal padding |
| `space.control.padding-y` | FLOAT | Button and input vertical padding |
| `space.control.gap` | FLOAT | Gap between icon and label |
| `space.stack.gap` | FLOAT | Default gap in a Stack |
| `space.stack.gap-loose` | FLOAT | Wide Stack variant |
| `space.card.padding` | FLOAT | Card inner padding |
| `space.card.gap` | FLOAT | Gap between Card children |
| `space.field.gap` | FLOAT | Label → input → description |

### Shape and size — 7

| Token | Figma type | Purpose |
| --- | --- | --- |
| `radius.control` | FLOAT | Buttons, inputs, selects |
| `radius.card` | FLOAT | Cards, panels |
| `radius.pill` | FLOAT | Badges, tags — `9999` |
| `border.control` | FLOAT | Control border width; `0` is valid |
| `border.card` | FLOAT | Card border width |
| `border.divider` | FLOAT | Rule width |
| `size.control` | FLOAT | Minimum button and input height |

### Type — 14

| Token | Figma type | Purpose |
| --- | --- | --- |
| `font.body.family` | STRING | Body typeface |
| `font.body.size` | FLOAT | Body size — the brand's base |
| `font.body.weight` | FLOAT | Usually 400 |
| `font.body.lineheight` | FLOAT | Unitless, e.g. 1.4 |
| `font.body.tracking` | FLOAT | Letter spacing, percent in Figma, `em` in the files |
| `font.heading.family` | STRING | Heading typeface; may differ from body |
| `font.heading.size` | FLOAT | Heading size |
| `font.heading.weight` | FLOAT | 600 / 700 / 900 |
| `font.heading.lineheight` | FLOAT | Unitless, tighter than body |
| `font.heading.tracking` | FLOAT | Letter spacing, percent in Figma, `em` in the files |
| `font.control.size` | FLOAT | Button and input label |
| `font.control.weight` | FLOAT | Usually 500–700 |
| `font.caption.size` | FLOAT | Captions, helper text |
| `font.caption.weight` | FLOAT | Usually 400 |

### Motion and elevation — 4

| Token | Figma type | Purpose |
| --- | --- | --- |
| `motion.control` | FLOAT | Hover and press, in ms |
| `motion.theme` | FLOAT | Brand-switch interpolation, in ms |
| `elevation.control` | STRING | Button shadow, or `none` |
| `elevation.card` | STRING | Card shadow, or `none` |

### Role — 9

Added 2026-11-04 for the Clementine and Pomelo home screens. Each exists because
the brands give the same *role* a different weight, size or colour, and a shared
component cannot branch on brand. A component reads the role, never the brand.

| Token | Figma type | Purpose | Clementine / Pomelo |
| --- | --- | --- | --- |
| `colour.text.nav` | COLOR | Resting nav and utility links | `neutral.600` / `neutral.800` |
| `colour.text.price` | COLOR | Selling price | `text.primary` / `text.accent` |
| `font.label.weight` | FLOAT | UI labels: nav links, inline actions | 500 / 400 |
| `font.label-strong.weight` | FLOAT | Active link, totals, initials | 600 / 500 |
| `font.name.weight` | FLOAT | Product names | 600 / 500 |
| `font.price.size` | FLOAT | Selling price | `size.md` (20) / `size.xs` (12) |
| `font.price.weight` | FLOAT | Selling price | 700 / 400 |
| `font.price.leading` | FLOAT | Price line box, px | `leading.md` (24) / `leading.xs` (16) |
| `font.price.tracking` | FLOAT | Price letter spacing, **px** | `tracking.tight` (−0.3px) / `0px` |

### Section tokens

Added 2026-11-06 for the shop, product and basket screens. Required only by the
sections that list them in `contracts/components.json`.

| Token | Read by | Clementine / Pomelo |
| --- | --- | --- |
| `colour.text.count` | `PageTitle`, `CatalogueGrid` | `text.muted` / `brand-2.500` |
| `colour.footer.bg` / `fg` / `mark` | `SiteFooter` | — / `brand-2.500`, `neutral.0`, `brand-2.600` |

## Component defaults — 3

Not values but *defaults*. A brand that can change a default rather than only a
value is a design system; one that can only change values is a stylesheet.

| Token | Figma type | Values |
| --- | --- | --- |
| `component.button.variant` | STRING | `primary`, `secondary` |
| `component.button.size` | STRING | `sm`, `md`, `lg` |
| `component.card.elevation` | STRING | `flat`, `raised` |

These cannot be applied by CSS — a React prop default has to come from data — so
they are read from `tokens.json`, not from `theme.css`.

## Primitives — shape required

109 per brand today. Sharing names lets one Figma collection hold every brand as
modes. A variable exists in every mode of its collection, so a single-brand
token still appears on the others with an unused value.

**Every size is a multiple of 4** (decided 2026-11-04): space, radius, font sizes
and px line heights. `radius.full` (9999) is the one exception, because it means
"fully round" rather than a step.

| Group | Count | Notes |
| --- | --- | --- |
| Neutral ramp | 10 | `0` (pure white), then `100`–`900` |
| Brand ramps | 27 | `brand-1`, `brand-2`, `brand-3`, each `100`–`900` |
| Status ramps | 27 | `red`, `green`, `amber`, each `100`–`900` |
| Space scale | 12 | 4px base: `0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 24` |
| Radius scale | 5 | `none, sm, md, lg, full` |
| Sizes | 2 | `control`, `border` |
| Font family | 1 | `sans`, with a `sans-serif` fallback |
| Font sizes | 6 | `xs, sm, md, lg, xl, 2xl`. `base` was retired 2026-11-04; use `sm` |
| Font weights | 5 | light, regular, medium, semibold, bold |
| Line heights | 3 | display, tight, normal — unitless |
| Leading | 4 | `xs 16, md 24, lg 32, 2xl 44` — px line boxes |
| Letter spacing | 5 | display, heading, body, wide (em) and `tight` (px) |
| Durations | 2 | fast, base |

Clementine's sizes are 12 / 16 / 20 / 24 / 32 / 40; Pomelo's 12 / 16 / 20 / 24 /
56 / 104.

### Clementine and Pomelo

`kumquat.tokens.json` is still in the repo and seeded, but Kumquat was cut from
the demo and no screen shows it.

| Group | Clementine | Pomelo |
| --- | --- | --- |
| `neutral` | white → black | white → brown |
| `brand-1` | orange | yellow |
| `brand-2` | yellow | red |
| `brand-3` | blue | green |
| `red` | status red | status red |
| `green` | status green | status green |
| `amber` | amber | amber |

The step holding the original Figma colour carries a `$description` naming it.
That step is the only one that follows the Figma primitive live (see
[Figma](#things-that-bite-in-figma)).

Ramps keep the base colour's HSL hue and saturation and vary lightness only. The
exception is `amber`: steps below the base drift 3° per step toward orange,
because pure-hue dark yellows go olive.

Semantic values were taken from the final screens on the Figma "example screens"
page. Where the brands differ most:

| | Clementine | Pomelo |
| --- | --- | --- |
| Font | Inter | DM Sans |
| Heading | 40px, 700, −2.5% | 104px, 700, −5% |
| `colour.action.bg` / `fg` | `brand-1.600` / `neutral.0` | `brand-1.500` / `neutral.900` |
| `colour.text.accent` | `brand-1.700` | `brand-2.600` |
| `radius.control` / `radius.card` | 9999px / 12px | 4px / 0px |
| `space.card.padding` | 20px | 24px |
| `size.control` | 44px | 52px |
| `elevation.card` | none | none |
| `component.card.elevation` | flat | flat |
| `colour.surface.page` | `neutral.0` (pure white) | `neutral.100` |

Still open:

- **`0` but no `50`.** `neutral.0` is pure `#ffffff`, for surfaces that sit on
  the page; `neutral.100` is the brand's own white and aliases its Figma
  primitive. There is no `50` step.
- **`green` has no semantic key.** `red` and `amber` map to `status.danger`
  and `status.warning`; there is no `status.success` to receive `green`. It
  stays a primitive until one is added to every brand.

In Figma the tokens live in three collections, each with a mode per brand:
`scales` (colour primitives), `type & space` (every other primitive) and
`semantic` (the 67 keys plus the three component defaults). A frame that uses
semantic colours needs its `scales` mode set as well as its `semantic` mode,
because an alias resolves in the referenced collection's own mode.

## Format

[W3C DTCG](https://tr.designtokens.org/format/). Three groups at the root —
`primitive`, `semantic`, `component`. A node is a token when it carries
`$value`; everything else is a group, and `$type` set on a group applies to
every token below it.

```json
{
  "primitive": {
    "colour": {
      "$type": "color",
      "green": { "600": { "$value": "#2f7a3f" } }
    }
  },
  "semantic": {
    "colour": {
      "$type": "color",
      "action": {
        "bg": { "$value": "{primitive.colour.green.600}" },
        "border": { "$value": "{semantic.colour.action.bg}" }
      }
    }
  }
}
```

References are whole paths from the root, in curly braces. Chains are normal —
`action.border` above points at another semantic token, which points at a
primitive. A chain that loops back on itself is a hard error reporting the path
that closes it.

`$type: "string"` is a Strata extension, used for elevation and component
defaults. DTCG has no base type for either. `$type` values are DTCG keywords,
so a colour token is `"$type": "color"` even though every group and path in
these files says `colour`.

## Notes

**Variables alias; they don't compute.** A variable can point at another
variable but cannot derive from it, so only one step per ramp can alias the
Figma primitive. The other eight are stored hex. Change a primitive and only
its base step follows; the rest of the ramp must be regenerated.

**Figma variables cannot hold a shadow.** The types are COLOR, FLOAT, STRING and
BOOLEAN; effects are effect styles, which are not variables. So
`elevation.control` and `elevation.card` are STRING variables with CSS typed in
by hand, or they stay out of Figma and are authored only in the token files.
Decide before building, not halfway through.

**FLOAT carries no unit.** Figma stores `16`, not `16px`; the export step
appends `px`. Line heights and font weights are the exception — genuinely
unitless, so they pass through unchanged. Letter spacing is stored as a
percent of the font size and exported as `em`: `-3.5` becomes `-0.035em`.

**Two kinds of line height and letter spacing.** `font.lineheight.*` are unitless
ratios and `font.tracking.*` (except `tight`) are percent in Figma and `em` in the
files, as above. `font.leading.*` and `font.tracking.tight` are **px**, because
Figma binds a text style's line height and letter spacing in pixels. Components
that need an exact line box (prices, labels) read the px tokens; running text
reads the ratios.

**Six of the 67 have no consumer yet** — `border.divider`,
`colour.border.strong`, the two `colour.status.*`, `colour.text.inverse` and
`radius.pill`. They are reserved for components not yet written: Select needs a
divider, Field needs a danger state, a badge needs the pill. Define them now
rather than reopening three Figma files later.

## Checking a brand

```bash
python tools/build_tokens.py <brand>
python -m pytest backend -q
```
