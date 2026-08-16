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
- **Content collections** with Zod schemas for case studies, games and universe
  entries. Adding an entry means adding a file, never editing a page.
- **Babylon.js** for the 3D line scenes, **Phaser** for playable game vignettes,
  **GSAP** for motion.
- **Tailwind 4** via the Vite plugin, on top of a hand-written token system in
  `src/styles/global.css`.

## Commands

```bash
npm run dev      # local dev server
npm run build    # production build
npm run preview  # serve the production build
npm run check    # astro check (types + templates)
npm run lint     # eslint
npm test         # build, then assert against the built HTML
```

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

## Performance rules

These are enforced by `tests/rendered-html.test.mjs`, so a regression fails the
build rather than being discovered a year later.

- The homepage ships **no eager external JavaScript**. Islands hydrate from a
  small inline bootstrap.
- **Babylon is deep-imported**, never as a namespace. A namespace import
  disables tree-shaking and costs about 1 MB gzip.
- Babylon deep imports target the side-effect wrapper modules, not the `.pure`
  variants, or cameras and materials never register at runtime.
- **Phaser downloads on click**, never on page load. The line-art poster is the
  default state, not a placeholder.
- No single JS chunk exceeds 400 KB gzip; the OG image stays under 300 KB.
- Fonts are self-hosted. No request ever leaves for a font CDN.

## Content

Case studies present an original in-page line-art demo and then link out to the
live product. Company products are never embedded in an iframe.

The universe is written here as the games are made — entries appear when a game
needs them, not before. `/universe` stays one flat collection until a `kind` has
enough entries to justify its own route.

## Deployment

Builds for Cloudflare via `@astrojs/cloudflare`. The adapter is one line in
`astro.config.mjs`; swapping to Node, Vercel or Netlify does not touch a page.

`eternalamarisuniverse.com` currently points at the previous GitHub Pages site.
No DNS change happens without an explicit decision to cut over.
