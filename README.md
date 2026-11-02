# Strata

A design system is not a component library. It is a build pipeline with a
versioning policy.

Strata is that pipeline: one set of unstyled components, a two-tier token
store that skins them per brand, and the machinery that resolves, compiles,
versions and ships those tokens to every consumer.

The component set never changes. Only the tokens do. A button is written once;
one brand's tokens can make it a tight 2px-radius utility control, another's a
generous 16px-radius editorial one. No conditionals, no brand props, no
forks.

## See it in thirty seconds

With the backend running (below) and seeded:

```bash
cd frontend
npm install
npm run dev                           # then open:
```

<http://127.0.0.1:3000/matrix>

Switch brands in the header. Nothing re-renders — the markup and class names
are identical on all three. Drag the `--radius-control` slider and every
component responds at once, which is the thing three hand-written stylesheets
could not do.

The app never imports a theme from `src/`. It loads
`/artifacts/<brand>/latest/theme.css` by URL, proxied to Django's artifact
store, so a publish in the admin restyles the page without a frontend
rebuild.

`python tools/build_tokens.py` resolves the token files into `dist/` without
Django or a database.

<http://127.0.0.1:3000/pipeline> shows the publish pipeline. Edit a brand's
layout to see a live preview, the changes against the published version, and
whether publish would accept it. It is a dry run through the real checks and
saves nothing; publishing happens in the admin.

## The token model

Two layers, and components only ever read the upper one.

```
primitive.colour.green.600   →  #2f7a3f          a raw value, named for what it is
semantic.colour.action.bg    →  {primitive.colour.green.600}
semantic.colour.action.border →  {semantic.colour.action.bg}
```

A component asks for `var(--colour-action-bg)`. It does not know it is green,
which is why it still makes sense on a brand whose action colour is teal.
Aliases may chain, so resolving them means walking a dependency graph rather
than doing find-and-replace — and a chain that loops back on itself has to
fail loudly instead of hanging.

Primitives are namespaced `--p-*` in the generated CSS. A component reaching
into the lower stratum is then visible in devtools rather than invisible.

Token files are [W3C DTCG](https://tr.designtokens.org/format/) format, so
Tokens Studio and Style Dictionary can read them.

## Layout

```
tokens/                 hand-authored DTCG files, one per brand
tools/build_tokens.py   the CLI: tokens/ → dist/
dist/                   generated artifacts (gitignored — rebuild, never edit)
frontend/               Next.js app
  app/strata.css        the headless component layer, identical on every brand
  app/components/       BrandProvider (loads theme.css by URL), primitives
  app/matrix/           the design system page
  app/brands/[brand]/   a brand's published home screen
  app/pipeline/         the publish dry-run page
  app/sections/         section components and ScreenRenderer
backend/
  strata_core/          the pipeline. Pure Python, no Django imports.
    parse.py            DTCG document → flat tokens
    graph.py            references → graph; cycle detection; topological sort
    resolver.py         follow every alias to a concrete value
    diff.py             what changed between two token documents
    classify.py         patch / minor / major for each change
    emitters/           CSS custom properties, JSON bundle
    layout.py           validate and diff published screens
    storage.py          the one place artifacts are written
  config/               Django project; serves artifacts/ in DEBUG
  tokens/               Django app: Brand, TokenSet, admin, publish, seed, API
  tests/                resolver, diff and classify tests
contracts/              the section types publish accepts
layouts/                starter screens, one file per brand
docker-compose.yml      Postgres on 5433
```

`strata_core` is deliberately free of framework imports, so the same code runs
from the command line and inside Django.

## Running the backend

Requires Docker Desktop for Postgres.

```bash
cp .env.example .env          # then set DJANGO_SECRET_KEY, or leave it blank
docker compose up -d db
cd backend
python manage.py migrate
python manage.py seed          # loads tokens/*.tokens.json as published v1
python manage.py createsuperuser
python manage.py runserver
```

Then <http://127.0.0.1:8000/admin/> to edit tokens without touching a
repository — which is the whole reason a designer can use this.

No secret key is committed. `settings.py` reads `DJANGO_SECRET_KEY` from the
gitignored `.env`; with `DEBUG` on and no key set it generates a throwaway one
per restart, and with `DEBUG` off it refuses to start rather than silently
invalidating every session on each deploy.

## Tests

```bash
docker compose up -d db
cd backend
python -m pytest
```

The Django tests need Postgres; the `strata_core` tests do not. Every run
prints a coverage table, writes `backend/htmlcov/` and `backend/coverage.xml`,
and fails below 85% line-and-branch coverage. CI runs the same command against
a Postgres service, posts the coverage table to the run summary and uploads the
HTML report as the `coverage-report` artifact.

The tests are about the ways the graph can be wrong, not the ways the happy
path can be right: missing references, two- and three-token cycles, a token
referencing itself, a 5,000-deep chain that must not exhaust the stack, a
primitive illegally reaching up into the semantic layer, and the rule that
every brand defines the core semantic tokens — without which one component
set is a fiction.

## Status

| | |
| --- | --- |
| Tokens, resolver, cycle detection | done |
| CSS + JSON emit, versioned artifact paths | done |
| Three brands, proof page, live slider | done |
| `Brand` / `TokenSet` models, admin, seed | done — needs Postgres running |
| Publish from admin rewrites `theme.css` / `tokens.json` | done — synchronous |
| Headless React components, the matrix page | done |
| Semantic diffing, severity classification | done — every publish is diffed against the previous version; major changes need explicit approval |
| Spacing, radius, type, default button, semantic values | assigned for all three brands — first-pass values, final designs pending |
| Brand sector and principle | placeholders in `seed.py` |
| CI: tests, 85% coverage gate, coverage report | done — `.github/workflows/ci.yml` |
| Server-published screens | pipeline done, one section type — see [DESIGN.md](DESIGN.md) |
| Publish dry-run page | done — `/pipeline` |
| Clementine and Pomelo home, product and cart screens | next — needs final designs; the cart stays in the browser, with no checkout |
| Publish from `/pipeline`, hosted demo, walkthrough | after the home screens |
| Celery build pipeline, SSE progress | deferred |
| Figma variable sync | deferred — verify Variables API plan access first |
| Drag editor | deferred |

## The three brands

Invented, and meant to differ as *systems* rather than as palettes.

| Brand | `brand-1` | `brand-2` | `brand-3` |
| --- | --- | --- | --- |
| Clementine | orange | yellow | blue |
| Pomelo | yellow | red | green |
| Kumquat | navy | light blue | sand yellow |

Colour primitives are exported from Figma. Spacing, radius, type scale,
default button and semantic tokens have first-pass values, to be replaced once
each brand is designed; sector and principle are placeholders. See
[tokens/CONTRACT.md](tokens/CONTRACT.md).

The default button matters more than it looks. A brand that can change a
*default* and not merely a value is a design system; one that can only change
values is a stylesheet.
