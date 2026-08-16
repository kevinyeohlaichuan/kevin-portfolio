import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const dist = new URL("dist/client/", root);

const html = (route) =>
  readFile(new URL(`${route}index.html`, dist), "utf8");
const source = (path) => readFile(new URL(path, root), "utf8");

const gzipSize = async (path) => {
  const { gzipSync } = await import("node:zlib");
  return gzipSync(await readFile(path)).length;
};

test("every route prerenders with a title, an h1 and its own description", async () => {
  const routes = [
    "", "work/", "work/gamuda-ss15/", "work/goprop-platform/",
    "games/", "games/i-got-a-system/", "games/nasi-lemak-survivors/",
    "games/the-waiter/", "games/to-infinity-and-beyond/",
    "universe/", "universe/eternal-amaris-universe/", "universe/the-system/",
    "about/", "card/",
  ];

  const descriptions = new Set();
  for (const route of routes) {
    const page = await html(route);
    assert.match(page, /<title>[^<]+<\/title>/, `${route} has no title`);
    assert.match(page, /<h1[^>]*>/, `${route} has no h1`);

    const description = page.match(/<meta name="description" content="([^"]+)"/)?.[1];
    assert.ok(description, `${route} has no meta description`);
    descriptions.add(description);

    assert.match(page, /<link rel="canonical"/, `${route} has no canonical`);
    assert.match(page, /property="og:image"/, `${route} has no og:image`);
  }

  // A shared boilerplate description on every page is an SEO smell.
  assert.ok(
    descriptions.size >= routes.length - 2,
    `descriptions are too duplicated: ${descriptions.size} unique across ${routes.length} routes`,
  );
});

test("the homepage's eager JavaScript stays at the router and nothing else", async () => {
  const page = await html("");

  // One deliberate exception to zero-eager-JS: the view transitions router.
  // It buys cross-route morphing and client-side navigation for ~5 KB gzip.
  // Everything else must hydrate from an island directive. This is the guard
  // against sliding back toward the 1.7 MB vinext homepage.
  const eager = [...page.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(eager.length, 1, `unexpected eager scripts: ${eager.join(", ")}`);
  assert.match(eager[0], /ClientRouter/, `unexpected eager script: ${eager[0]}`);

  const routerSize = await gzipSize(new URL(`.${eager[0]}`, dist));
  assert.ok(
    routerSize < 10_000,
    `router grew to ${Math.round(routerSize / 1024)} KB gzip, ceiling is 10 KB`,
  );

  const inlineBytes = [...page.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)]
    .reduce((total, match) => total + Buffer.byteLength(match[1]), 0);
  assert.ok(inlineBytes < 20_000, `inline JS grew to ${inlineBytes} bytes`);

  // Heavy runtimes must be behind client directives, never inlined.
  assert.match(page, /client="visible"/);
  assert.doesNotMatch(page, /phaser/i);
});

test("Babylon stays statically imported but never as a namespace", async () => {
  const babylon = await source("src/components/BabylonLineScene.tsx");

  // A dynamic import() inside the client chunk gets stripped by the optimiser,
  // and a namespace import defeats tree-shaking and costs ~1 MB gzip.
  assert.match(babylon, /import \{ Engine \} from "@babylonjs\/core\/Engines\/engine\.js"/);
  assert.doesNotMatch(babylon, /import \* as B from "@babylonjs\/core"/);
  assert.doesNotMatch(babylon, /import\("@babylonjs/);

  // Deep paths must target the side-effect wrappers, not ".pure" modules,
  // or cameras/materials/builders never register at runtime.
  assert.doesNotMatch(babylon, /@babylonjs\/core\/[^"]*\.pure/);
});

test("Phaser only loads on an explicit click", async () => {
  const demo = await source("src/components/GameMicroDemo.tsx");
  assert.match(demo, /lazy\(/);
  assert.match(demo, /game-start-button/);
  assert.doesNotMatch(demo, /next\/dynamic/);

  const runtime = await source("src/components/GameCanvasRuntime.tsx");
  assert.match(runtime, /import Phaser from "phaser"/);
});

test("no company product is embedded in an iframe", async () => {
  // Decision D08: an original in-page line demo, then a link out. No iframes.
  for (const route of ["", "work/gamuda-ss15/", "work/goprop-platform/"]) {
    const page = await html(route);
    assert.doesNotMatch(page, /<iframe/i, `${route} embeds an iframe`);
  }
  assert.ok(!existsSync(new URL("src/components/LiveProductFrame.tsx", root)));
});

test("content collections drive the routes", async () => {
  const work = await readdir(new URL("src/content/work", root));
  const games = await readdir(new URL("src/content/games", root));
  const universe = await readdir(new URL("src/content/universe", root));

  assert.ok(work.length >= 2, "expected at least two case studies");
  assert.ok(games.length >= 4, "expected at least four games");
  assert.ok(universe.length >= 1, "the universe needs somewhere to start");

  // Every game file must produce a route.
  for (const file of games) {
    const slug = file.replace(/\.mdx?$/, "");
    await stat(new URL(`games/${slug}/index.html`, dist));
  }
});

test("assets stay inside budget", async () => {
  const og = await stat(new URL("public/og.jpg", root));
  assert.ok(og.size < 300_000, `og image is ${Math.round(og.size / 1024)} KB, budget is 300 KB`);

  const chunks = await readdir(new URL("_astro/", dist));
  for (const file of chunks.filter((f) => f.endsWith(".js"))) {
    const size = await gzipSize(new URL(`_astro/${file}`, dist));
    assert.ok(
      size < 400_000,
      `${file} is ${Math.round(size / 1024)} KB gzip, budget is 400 KB`,
    );
  }
});

test("fonts are self-hosted, not fetched from a CDN", async () => {
  const css = await source("src/styles/global.css");
  assert.match(css, /@fontsource\/geist-sans/);
  assert.match(css, /--font-geist-sans:/);

  const files = await readdir(new URL("_astro/", dist));
  assert.ok(files.some((f) => f.endsWith(".woff2")), "no woff2 shipped");

  for (const route of ["", "about/"]) {
    const page = await html(route);
    assert.doesNotMatch(page, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
  }
});

test("structured data, sitemap and feed are present", async () => {
  const about = await html("about/");
  assert.match(about, /"@type":\s*"Person"/);

  const game = await html("games/nasi-lemak-survivors/");
  assert.match(game, /"@type":\s*"VideoGame"/);

  const study = await html("work/gamuda-ss15/");
  assert.match(study, /"@type":\s*"CreativeWork"/);

  const feed = await readFile(new URL("rss.xml", dist), "utf8");
  assert.match(feed, /<rss version="2\.0"/);
  assert.match(feed, /Nasi Lemak Survivors/);

  await stat(new URL("sitemap-index.xml", dist));
});

test("no Next or vinext remnants survive", async () => {
  const pkg = JSON.parse(await source("package.json"));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };

  for (const gone of ["next", "vinext", "@next/eslint-plugin-next", "react-server-dom-webpack"]) {
    assert.ok(!(gone in deps), `${gone} is still a dependency`);
  }

  assert.equal(pkg.scripts.build, "astro build");
  for (const file of ["next.config.ts", "next-env.d.ts", "vite.config.ts", "app"]) {
    assert.ok(!existsSync(new URL(file, root)), `${file} still exists`);
  }
});

test("the command palette is keyboard-first and content-driven", async () => {
  const palette = await source("src/components/CommandPalette.tsx");

  // Opens on both the conventional shortcut and a bare slash.
  assert.match(palette, /metaKey \|\| event\.ctrlKey/);
  assert.match(palette, /event\.key === "\/"/);
  assert.match(palette, /event\.key === "Escape"/);
  assert.match(palette, /ArrowDown/);
  assert.match(palette, /ArrowUp/);

  // Dialog semantics, not a styled div.
  assert.match(palette, /role="dialog"/);
  assert.match(palette, /aria-modal="true"/);
  assert.match(palette, /role="listbox"/);
  assert.match(palette, /role="option"/);
  assert.match(palette, /aria-activedescendant/);

  // Every route reachable from the palette must be in the built output.
  const home = await html("");
  for (const slug of ["/work", "/games", "/universe", "/about", "/card"]) {
    assert.ok(home.includes(slug), `palette target ${slug} missing from page`);
  }
});

test("the mesh visualiser uses the real project numbers", async () => {
  const mesh = await source("src/components/MeshBudget.tsx");
  assert.match(mesh, /SOURCE_MB = 239\.8/);
  assert.match(mesh, /SHIPPED_MB = 34\.6/);

  // Canvas 2D on purpose — no second WebGL context on the homepage.
  // Checks real usage, not the word: the file's own comment says "WebGL".
  assert.match(mesh, /getContext\("2d"\)/);
  assert.doesNotMatch(mesh, /from "@babylonjs/);
  assert.doesNotMatch(mesh, /getContext\(["']webgl/i);
  assert.match(mesh, /prefers-reduced-motion/);
});

test("pixel art is authored, not filtered", async () => {
  const pixel = await source("src/components/PixelVigil.tsx");

  // Hand-authored sprite rows and a fixed palette.
  assert.match(pixel, /const FIGURE = \[/);
  assert.match(pixel, /const SWORD = \[/);
  assert.match(pixel, /const PALETTE/);

  // Integer scaling and smoothing off, or it stops being pixel art.
  assert.match(pixel, /imageSmoothingEnabled = false/);
  assert.match(pixel, /Math\.floor\(parent\.clientWidth \/ W\)/);
  assert.match(pixel, /prefers-reduced-motion/);

  const css = await source("src/styles/global.css");
  assert.match(css, /image-rendering: pixelated/);
});

test("the site commits to one theme rather than shipping a broken second one", async () => {
  const css = await source("src/styles/global.css");

  // The identity is glowing line art on void. A light ground would need the
  // cosmos, sword and every glow redrawn, so the dark commitment is explicit
  // and declared, not accidental.
  assert.match(css, /color-scheme: dark/);
  assert.doesNotMatch(css, /\[data-theme="light"\]/);
  assert.ok(!existsSync(new URL("src/components/ThemeToggle.astro", root)));

  for (const route of ["", "about/"]) {
    const page = await html(route);
    assert.match(page, /name="color-scheme" content="dark"/, `${route} does not declare its scheme`);
  }
});

test("view transitions and landmarks are wired", async () => {
  const css = await source("src/styles/global.css");
  assert.match(css, /@view-transition/);

  const layout = await source("src/layouts/Base.astro");
  assert.match(layout, /ClientRouter/);

  for (const route of ["", "about/", "games/", "universe/"]) {
    const page = await html(route);
    assert.match(page, /class="skip-link"/, `${route} has no skip link`);
    assert.match(page, /id="main"/, `${route} has no main landmark target`);
  }
});
