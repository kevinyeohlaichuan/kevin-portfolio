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

The site builds as a Cloudflare Worker through `@astrojs/cloudflare`. Gandi can
remain the domain registrar; only authoritative DNS moves to Cloudflare when
the tested Worker is ready for the public cutover.

Local contact testing uses Cloudflare's documented test keys:

```bash
cp .dev.vars.example .dev.vars
npm run dev
```

Before a production upload:

1. Create the Turnstile widget and replace `PUBLIC_TURNSTILE_SITE_KEY` plus
   `REPLACE_WITH_WORKERS_HOST` in `wrangler.jsonc` with both exact hosts:
   `kevin-portfolio.<account>.workers.dev` and
   `staging-kevin-portfolio.<account>.workers.dev`.
2. Onboard `eternalamarisuniverse.com` in Cloudflare Email Service and verify
   `spicymsgstudio@gmail.com` as the destination.
3. Copy `.env.production.example` to the ignored `.env.production` file and
   replace its value with the real Turnstile secret. Deployment refuses test
   keys, missing files and extra variables.
4. Authenticate and validate before the first workers.dev deployment:

```bash
npx wrangler login
npm run deploy:check
npm run deploy:dry
npm run deploy
```

After the first deployment, upload an isolated preview and promote that exact
version after verification:

```bash
npm run deploy:preview
npm run deploy:promote -- <VERSION_ID>@100% -y
```

Domain routes stay out of `wrangler.jsonc` until the workers.dev version is
verified. The eventual cutover preserves the existing Google verification TXT,
removes the conflicting GitHub Pages apex/www records, and adds the Worker
custom domains only after Cloudflare reports the zone active.
