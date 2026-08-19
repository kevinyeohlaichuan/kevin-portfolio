import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import test from "node:test";
import { contactInputSchema } from "../src/lib/contact-schema.ts";

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
    "universe/", "universe/eternal-amaris-universe/",
    "about/", "contact/", "card/", "time-machine/",
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
  assert.match(babylon, /import "@babylonjs\/core\/Culling\/ray\.js"/);
  assert.doesNotMatch(babylon, /@babylonjs\/core\/[^"]*\.pure/);
});

test("babylon picking passes CSS pixels, not backing-store pixels", async () => {
  // Babylon multiplies by 1 / hardwareScalingLevel internally, so scaling by
  // canvas.width / bounds.width here squares the device pixel ratio and breaks
  // picking on every HiDPI screen.
  const scene = await source("src/components/BabylonLineScene.tsx");
  const pick = scene.match(/const pickAt[\s\S]*?\n {4}\};/)?.[0] ?? "";
  assert.match(pick, /event\.clientX - bounds\.left/);
  assert.doesNotMatch(pick, /canvas\.width \/ bounds\.width/);
  assert.doesNotMatch(pick, /canvas\.height \/ bounds\.height/);
});

test("Phaser only loads on an explicit click", async () => {
  const demo = await source("src/components/GameMicroDemo.tsx");
  assert.match(demo, /lazy\(/);
  assert.match(demo, /game-start-button/);
  assert.match(demo, /stageRef/);
  assert.match(demo, /scrollIntoView/);
  assert.doesNotMatch(demo, /next\/dynamic/);

  const runtime = await source("src/components/GameCanvasRuntime.tsx");
  assert.match(runtime, /import Phaser from "phaser"/);

  const config = await source("astro.config.mjs");
  assert.match(config, /exclude: \["phaser"\]/);
});

test("no company product is embedded in an iframe", async () => {
  // Decision D08: an original in-page line demo, then a link out. No iframes.
  for (const route of ["", "work/gamuda-ss15/", "work/goprop-platform/"]) {
    const page = await html(route);
    assert.doesNotMatch(page, /<iframe/i, `${route} embeds an iframe`);
  }
  assert.ok(!existsSync(new URL("src/components/LiveProductFrame.tsx", root)));
});

test("contact is a validated Cloudflare-backed action with a mail fallback", async () => {
  const page = await html("contact/");
  assert.match(page, /data-contact-form/);
  assert.match(page, /<form[^>]*method="post"/);
  assert.match(page, /name="name"/);
  assert.match(page, /name="email"/);
  assert.match(page, /name="topic"/);
  assert.match(page, /name="message"/);
  assert.match(page, /name="website"/);
  assert.match(page, /class="cf-turnstile"/);
  assert.match(page, /data-action="contact"/);
  assert.match(page, /The secure form needs JavaScript/);
  assert.match(page, /mailto:spicymsgstudio@gmail\.com/);

  const action = await source("src/actions/index.ts");
  assert.match(action, /defineAction/);
  assert.match(action, /accept: "form"/);
  assert.match(action, /contactInputSchema/);
  assert.match(action, /siteverify/);
  assert.match(action, /result\.action === "contact"/);
  assert.match(action, /hostnameAllowed/);
  assert.match(action, /internal-error/);
  assert.match(action, /invalid-input-secret/);
  assert.match(action, /CONTACT_RATE_LIMITER/);
  assert.match(action, /TOO_MANY_REQUESTS/);
  assert.match(action, /new TextEncoder\(\)\.encode\(requester\)/);
  assert.doesNotMatch(action, /context\.clientAddress/);
  assert.match(action, /if \(input\.website\) return \{ delivered: true \}/);
  assert.match(action, /CONTACT_EMAIL/);
  assert.match(action, /replyTo/);

  const configSource = await source("wrangler.jsonc");
  const config = JSON.parse(configSource);
  assert.equal(config.send_email[0].destination_address, "spicymsgstudio@gmail.com");
  assert.ok(config.send_email[0].allowed_sender_addresses.length > 0);
  assert.ok(config.ratelimits.length > 0);
  assert.ok(config.secrets.required.includes("TURNSTILE_SECRET_KEY"));
  assert.equal(config.vars.TURNSTILE_SECRET_KEY, undefined);
  assert.doesNotMatch(configSource, /1x0000000000000000000000000000000AA/);
  assert.doesNotMatch(config.vars.TURNSTILE_ALLOWED_HOSTNAMES, /\*|localhost|127\.0\.0\.1/);

  const pageSource = await source("src/pages/contact.astro");
  assert.doesNotMatch(pageSource, /status\.textContent = error\.message/);
  assert.match(pageSource, /window\.turnstile\.render/);
  assert.match(pageSource, /api\.js\?render=explicit/);
  assert.match(pageSource, /container\.clientWidth < 300 \? "compact" : "flexible"/);
  assert.match(pageSource, /astro:page-load/);
  assert.match(pageSource, /resetTurnstile\(\)/);

  const astroConfig = await source("astro.config.mjs");
  assert.match(astroConfig, /actionBodySizeLimit: 32 \* 1024/);

  const packageJson = JSON.parse(await source("package.json"));
  assert.match(packageJson.scripts["deploy:check"], /validate-production-secret/);
  for (const script of ["deploy:dry", "deploy:preview", "deploy"]) {
    assert.match(packageJson.scripts[script], /--secrets-file \.env\.production/);
  }

  const deployValidator = await source("scripts/validate-deploy.mjs");
  assert.match(deployValidator, /staging-kevin-portfolio/);
});

test("contact input accepts Astro's null representation for empty optional form fields", () => {
  const input = contactInputSchema.parse({
    name: "Ada Lovelace",
    email: "ada@example.com",
    topic: "collaboration",
    message: "I would like to discuss an interactive project.",
    website: null,
    "cf-turnstile-response": null,
  });

  assert.equal(input.website, "");
  assert.equal(input["cf-turnstile-response"], "");

  assert.throws(() => contactInputSchema.parse({ ...input, email: "not-an-email" }));
  assert.throws(() => contactInputSchema.parse({ ...input, message: "too short" }));
});

test("content collections drive the routes", async () => {
  const work = await readdir(new URL("src/content/work", root));
  const games = await readdir(new URL("src/content/games", root));
  const universe = await readdir(new URL("src/content/universe", root));

  assert.ok(work.length >= 2, "expected at least two work projects");
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
  for (const slug of ["/work", "/games", "/universe", "/about", "/contact", "/card"]) {
    assert.ok(home.includes(slug), `palette target ${slug} missing from page`);
  }
});

test("property discovery waits for the conversation before highlighting", async () => {
  const scene = await source("src/components/BabylonLineScene.tsx");
  assert.match(scene, /How may I assist you\?/);
  assert.match(scene, /Retirement living/);
  assert.match(scene, /Working adults/);
  assert.match(scene, /Nearby amenities/);
  assert.match(scene, /ROI potential/);
  assert.match(scene, /showMatches\(\[\.\.\.result\.matches\]\)/);
  assert.doesNotMatch(scene, /Run AI discovery preview/i);
});

test("the archviz dock is collapsible and units are pickable by type", async () => {
  const scene = await source("src/components/BabylonLineScene.tsx");
  assert.match(scene, /Collapse panel/);
  assert.match(scene, /Expand panel/);
  assert.match(scene, /panelOpen \? "›" : "‹"/);
  assert.match(scene, /panelOpen \? "⌃" : "⌄"/);
  assert.doesNotMatch(scene, />Hide panel</);
  assert.doesNotMatch(scene, /Explore project/);
  assert.match(scene, /Click a unit in the viewport/);
  assert.match(scene, /Tower 1/);
  assert.match(scene, /Tower 2/);
  assert.match(scene, /Tower 3/);
  assert.doesNotMatch(scene, /Tower A|Tower B|Tower C/);
  assert.match(scene, /Type A/);
  assert.match(scene, /Type B/);
  assert.match(scene, /Type C/);
  assert.match(scene, /colorless/);
  assert.match(scene, /view\.unitType === meta\.type/);
  assert.match(scene, /view\.selectedId === meta\.id/);
  assert.match(scene, /view\.unitType = null/);
  // Selecting a tower isolates it in the viewport; the button itself stays legible.
  assert.match(scene, /view\.activeTower !== null && view\.activeTower !== meta\.tower/);
  assert.match(scene, /Show only \$\{tower\.id\}/);
  assert.match(scene, /activeTower === tower\.id \? "active" : ""/);
  assert.doesNotMatch(scene, /hiddenTowers/);
  assert.doesNotMatch(scene, /typeWires/);
  assert.match(scene, /scene\.pick\(/);
  assert.match(scene, /pointerup/);
  assert.match(scene, /width: tower\.width, depth: tower\.depth, height: 0\.42/);
  assert.doesNotMatch(scene, /const cell = tower\.width/);

  const css = await source("src/styles/global.css");
  assert.match(css, /width: min\(270px, 25%\)/);
  assert.match(css, /orientation: portrait/);
  assert.match(css, /\.property-chat \{[^}]*overflow-y: auto/);
  assert.match(css, /\.tower-options button\.active \{/);
  assert.doesNotMatch(css, /\.tower-options button\.hidden/);
});

test("the time machine preserves the old site without a self-referential live link", async () => {
  const page = await html("time-machine/");
  assert.match(page, /id="legacy-captures"/);
  assert.match(page, /View the preserved captures/);
  assert.doesNotMatch(page, /<a[^>]*href="https:\/\/(?:www\.)?eternalamarisuniverse\.com/);
  assert.doesNotMatch(page, /<a[^>]*href="https:\/\/kevinyeohlaichuan\.github\.io/);
  // The old captures ship optimised, not as the 1.2MB source PNGs.
  assert.doesNotMatch(page, /legacy-site-desktop-2026-08-15\.png/);
  const footer = await source("src/components/SiteFooter.astro");
  assert.match(footer, /href="\/time-machine"/);
});

test("archviz stacks unit types in bands rather than alternating per floor", async () => {
  const scene = await source("src/components/BabylonLineScene.tsx");
  assert.match(scene, /stacking: \["Type/);
  assert.match(scene, /bandSize/);
  // The old checkerboard picked a layout by floor index modulo the list.
  assert.doesNotMatch(scene, /UNIT_LAYOUTS\[floorIndex % UNIT_LAYOUTS\.length\]/);
  assert.match(scene, /unitBands/);
});

test("nasi lemak hands every upgrade to the player instead of choosing", async () => {
  const runtime = await source("src/components/GameCanvasRuntime.tsx");
  assert.match(runtime, /buildUpgradeOptions/);
  assert.match(runtime, /state\.paused = true/);
  assert.match(runtime, /levelUpRef\.current\?\.\(state\.level, buildUpgradeOptions\(\)\)/);
  // The old flow unlocked and upgraded on its own.
  assert.doesNotMatch(runtime, /NASI LEMAK BERAPI UNLOCKED/);
  const demo = await source("src/components/GameMicroDemo.tsx");
  assert.match(demo, /upgrade-choice/);
  assert.match(demo, /applyUpgrade/);
});

test("moving a platform restores its static body size and offset", async () => {
  // refreshBody() resets width/height from the game object's 4x4 texture, which
  // silently disabled collision for the rest of the climb.
  const runtime = await source("src/components/GameCanvasRuntime.tsx");
  const place = runtime.match(/const placePlatform[\s\S]*?\n {4}\};/)?.[0] ?? "";
  assert.match(place, /setOffset\(0, 0\)/);
  assert.match(place, /refreshBody\(\)/);
  assert.match(place, /setSize\(platform\.width, 10\)/);
  assert.ok(place.indexOf("setOffset") < place.indexOf("refreshBody"), "offset must be normalised before the sync");
  assert.ok(place.indexOf("refreshBody") < place.indexOf("setSize"), "size must be restored after the sync");
});

test("the games accept held touch input and coarse-pointer targets", async () => {
  const runtime = await source("src/components/GameCanvasRuntime.tsx");
  assert.match(runtime, /readTouchDirection/);
  assert.match(runtime, /input\.manager\.pointers/);
  assert.match(runtime, /addPointer\(2\)/);
  const css = await source("src/styles/global.css");
  assert.match(css, /@media \(pointer: coarse\)/);
});

test("the system host runs itself: levels from kills, equips, learns and settles", async () => {
  const game = await source("src/components/SystemGameDemo.tsx");
  // Levels come from mobs, not only from reaching the exit.
  assert.match(game, /gainExperience\(next, experience, messages\)/);
  assert.match(game, /LEVEL UP · host reaches/);
  // Drops are equipment, pills or manuals, all handled without the player.
  assert.match(game, /Auto-equipped/);
  assert.match(game, /Auto-learned/);
  assert.match(game, /considerEquipment/);
  assert.match(game, /considerPills/);
  // Skills level through use.
  assert.match(game, /const skillLevel = \(uses: number\)/);
  assert.match(game, /reaches Lv\.\$\{levelled\} through use/);
  // The run settles into a ledger of spending and non-spending.
  assert.match(game, /const settleRun/);
  assert.match(game, /Sold outgrown equipment/);
  assert.match(game, /Did not restock pills/);
  assert.match(game, /Did not buy a better weapon/);
  // Standing on the open exit beats fleeing, or the host dies on its own doorstep.
  assert.match(game, /const standingOn = run\.features\[run\.hostCell\]/);
  const urgentIndex = game.indexOf("if (urgent && nearestThreatGap");
  assert.ok(game.indexOf("const standingOn") < urgentIndex, "the exit check must precede the threat response");
  // The panels show real state, not the old hardcoded props.
  assert.doesNotMatch(game, /Cloudveil Crown|Windstep Boots|Ember Palm|Iron ore/);
});

test("the click-to-start gate fills the stage instead of collapsing to zero height", async () => {
  // The stage sets only min-height at desktop width, so height:100% here resolves
  // against auto and the start button becomes invisible and unclickable.
  const css = await source("src/styles/global.css");
  assert.match(css, /\.game-start-shell \{ position: absolute; inset: 0; \}/);
  assert.doesNotMatch(css, /\.game-start-shell \{[^}]*height: 100%/);
});

test("the system demo preserves autonomous progression around search, hit and run", async () => {
  const game = await source("src/components/SystemGameDemo.tsx");
  assert.match(game, /window\.localStorage/);
  assert.match(game, /window\.setInterval/);
  assert.match(game, /system-left-panel/);
  assert.match(game, /Stats/);
  assert.match(game, /Equipment/);
  assert.match(game, /Inventory/);
  assert.match(game, /Skills/);
  assert.match(game, /Lifespan/);
  assert.match(game, /Obedience/);
  assert.match(game, /LEARNED HOST BEHAVIOUR/);
  assert.match(game, /POST-RUN REVIEW/);
  assert.match(game, /Automatic/);
  assert.match(game, /搜 Search/);
  assert.match(game, /打 Hit/);
  assert.match(game, /跑 Run/);
  assert.doesNotMatch(game, /割/);
  assert.match(game, /hasSight/);
  assert.match(game, /100 \/ actingMonster\.speed/);
  assert.match(game, /bronze/);
  assert.match(game, /jade/);
  assert.match(game, /sigil/);
  assert.match(game, /type: "chest"/);
  assert.match(game, /type: "exit"/);
  assert.match(game, /timeLimit/);
  assert.match(game, /TIME ALERT/);
  assert.match(game, /TIME EXPIRED/);
  assert.match(game, /outcome = "timeout"/);
});

test("the games showcase stays open-ended and separates mobile surfaces", async () => {
  const home = await source("src/pages/index.astro");
  // The homepage section must not hard-code how many games exist — that is the
  // open-ended part. Pinning the exact headline here only blocks copy edits.
  assert.doesNotMatch(home, /Three games/);

  const css = await source("src/styles/global.css");
  assert.match(css, /\.game-showcase \{ display: flex; flex-direction: column; gap: 12px/);
  assert.match(css, /\.game-stage-shell:has\(\.system-game\) \{ min-height: 0; height: auto/);
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
