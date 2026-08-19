# Kevin Yeoh — EAU Portfolio

Public portfolio for Kevin Yeoh and the Eternal Amaris Universe.

Employer-first at the root, with the games and the universe one click below.
Three audience doors — `/work`, `/games`, `/universe` — each a real URL rather
than an anchor on a single page.

## Stack

- **Astro 7** with `output: "server"` and the Cloudflare adapter. Pages opt into
  prerendering individually, so nothing forecloses growing into a real
  application later.
- **React 19** for interactive islands only. Islands are framework-agnostic:
  a component can be swapped to another framework without touching the site.
- **Content collections** with Zod schemas for work projects, games and universe
  entries. Adding an entry means adding a file, never editing a page.
- **Babylon.js** for the 3D line scenes, **Phaser** for playable game vignettes,
  **GSAP** for motion.
- **Tailwind 4** via the Vite plugin, on top of a hand-written token system in
  `src/styles/global.css`.

## Commands

```bash
npm run dev      # local dev server
npm run build    # production build
npm run preview  # build, then serve through the local Workers runtime
npm run check    # astro check (types + templates)
npm run lint     # eslint
npm test         # build, then assert against the built HTML
```

Astro keeps one background dev server per checkout. If `npm run dev` says one
is already running, use the URL it prints. To replace it cleanly:

```bash
npx astro dev stop
npm run dev
```

Stop the dev server before running `npm ci` on Windows; native dependencies can
otherwise remain locked by the running process.

## Layout

```
src/
  components/    React islands + .astro partials
  content/       work, games, universe — MDX with typed frontmatter
  layouts/       Base.astro: head, metadata, theming
  pages/         routes; [...slug].astro drives collection detail pages
  styles/        global.css — the whole visual system
  content.config.ts
public/          static assets served as-is
docs/legacy-site/  archive of the GitHub Pages era, kept as a record
tests/           runtime assertions against dist/
```

## What's on the page

- **Command palette** (`CommandPalette.tsx`) — `⌘K` or `/`. Ranked search over
  every work project, game and universe entry, with arrow-key navigation and
  full listbox semantics.
- **Pixel scene** (`PixelVigil.tsx`) — hand-authored sprites on a fixed
  14-colour palette, 128×80 buffer, integer upscaling, 12 fps step timer.
- **Babylon line scenes** for the archviz previews, **Phaser** vignettes behind
  an explicit click, **GSAP** for the sword cursor and scroll motion.
- **View transitions** between routes via Astro's `ClientRouter`.
- **Contact Action** at `/contact`, validated on the server with Zod, Cloudflare
  Turnstile and a native rate-limit binding before a fixed-recipient email send.
  Visitor input can only become the reply-to address and plain-text body.
  Delivery is intentionally at-least-once: after a rare ambiguous network
  failure, a visitor retry may produce a duplicate email rather than lose the
  enquiry silently.

## Theme

The site deliberately commits to one visual world. The identity is glowing
line art on void; a light ground would require the cosmos, sword and every
glow to be redrawn, which is a redesign rather than a token swap. `color-scheme`
is declared explicitly so form controls and scrollbars follow.

## Performance rules

These are enforced by `tests/rendered-html.test.mjs`, so a regression fails the
build rather than being discovered a year later.

- The homepage ships **exactly one eager external script**: the view-transitions
  router, ~5 KB gzip, capped at 10 KB by test. Everything else hydrates from an
  island directive.
- **Babylon is deep-imported**, never as a namespace. A namespace import
  disables tree-shaking and costs about 1 MB gzip.
- Babylon deep imports target the side-effect wrapper modules, not the `.pure`
  variants, or cameras and materials never register at runtime.
- **Phaser downloads on click**, never on page load. The line-art poster is the
  default state, not a placeholder.
- No single JS chunk exceeds 400 KB gzip; the OG image stays under 300 KB.
- Fonts are self-hosted. No request ever leaves for a font CDN.

## Content

Work projects present an original in-page line-art demo and then link out to the
live product. Company products are never embedded in an iframe.

The universe is written here as the games are made — entries appear when a game
needs them, not before. `/universe` stays one flat collection until a `kind` has
enough entries to justify its own route.

## Cloudflare deployment

The site builds as a Cloudflare Worker through `@astrojs/cloudflare`. Gandi
remains the domain registrar while Cloudflare provides authoritative DNS,
Worker routing, Turnstile and Email Routing.

Current deployment state (2026-08-19):

- The production Worker is deployed at
  `https://kevin-portfolio.kevinyeohlaichuan5385.workers.dev`.
- The production Turnstile widget and its exact apex, `www`, Worker and staging
  hostnames are configured in `wrangler.jsonc`. Its site key is public; the
  secret key exists only in the ignored `.env.production` file.
- Astro's `SESSION` binding is pinned to the provisioned KV namespace in
  `wrangler.jsonc`, preventing a later deployment from creating another one.
- `eternalamarisuniverse.com/*` and `www.eternalamarisuniverse.com/*` route to
  the production Worker. `www` redirects to the HTTPS apex and Cloudflare's
  Always Use HTTPS setting covers direct HTTP requests.
- Gandi delegates DNS to `eloise.ns.cloudflare.com` and
  `patryk.ns.cloudflare.com`; the registrar and renewal remain at Gandi.
- HTTP/3 is temporarily disabled under Cloudflare's Protocol Optimization
  settings after the cutover exposed stale pre-Cloudflare DNS and QUIC state
  in Chrome. HTTPS remains live over HTTP/2; re-evaluate HTTP/3 after the old
  three-hour DNS TTL and affected browser caches have fully expired.
- Free Cloudflare Email Routing is active. `spicymsgstudio@gmail.com` is a
  verified destination, and `contact@eternalamarisuniverse.com` forwards to it.
  A real submission from the public apex completed successfully.

Local contact testing uses Cloudflare's documented test keys:

```bash
cp .dev.vars.example .dev.vars
npm run dev
```

The tracked configuration already contains the production account, public
Turnstile site key, hostname allowlist, email addresses, rate limiter, KV
binding and public routes. Before a production upload:

1. Copy `.env.production.example` to the ignored `.env.production` file and
   replace its value with the real Turnstile secret. Deployment refuses test
   keys, missing files and extra variables.
2. Authenticate and validate before uploading another Worker version:

```bash
npx wrangler login
npm run deploy:check
npm run deploy:dry
npm run deploy
```

For an isolated preview, upload a staging alias and promote that exact version
after verification:

```bash
npm run deploy:preview
npm run deploy:promote -- <VERSION_ID>@100% -y
```

The proxied GitHub Pages apex and `www` records remain as a rollback origin;
the Worker routes run before that origin and serve the production site. The
Google verification TXT is preserved. Removing the two routes and redeploying
returns web traffic to that origin without changing the Cloudflare nameservers
or Email Routing records.
