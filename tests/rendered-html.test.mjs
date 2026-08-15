import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the complete portfolio", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Kevin Yeoh — Full-Stack Archviz, Interactive 3D &amp; Games<\/title>/i);
  assert.match(html, /Building/);
  assert.match(html, /digital worlds/);
  assert.match(html, /flying cultivation sword/i);
  assert.doesNotMatch(html, /MILKY WAY|EAU SECTOR 001|ORGANIC \+ MACHINE|神 · 魔 · 妖 · 人|HUMAN SECTOR|CULTIVATION SECTOR/);
  assert.match(html, /Architectural visualisation/);
  assert.match(html, /HauS on 15 — Gamuda SS15/);
  assert.match(html, /PHP and MySQL/);
  assert.match(html, /HeidiSQL data work/);
  assert.match(html, /GoProp Platform/);
  assert.match(html, /I Got a System/);
  assert.match(html, /Nasi Lemak Survivors/);
  assert.doesNotMatch(html, /Solo engineering|Shared with Koh|Selected work/i);
  assert.match(html, /https:\/\/goprop\.ai\/demo\/gamuda-ss15\//);
  assert.match(html, /https:\/\/dev\.goprop\.ai\//);
  assert.match(html, /property="og:image"/);
  assert.match(html, /\/og-v2\.png/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("keeps the finished portfolio responsive, accessible and production-safe", async () => {
  const [page, layout, css, packageJson, cosmos, sword, babylon, game, gameRuntime, motion, loaders] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/components/EAUCosmos.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/OrnateSword.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/BabylonLineScene.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/GameMicroDemo.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/GameCanvasRuntime.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/EAUMotion.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/InteractiveLoaders.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(page, /aria-label="Primary navigation"/);
  assert.match(page, /<EAUCosmos \/>/);
  assert.match(page, /className="hero-cosmos"/);
  assert.doesNotMatch(page, /BabylonLineScene mode="hero"/);
  assert.match(page, /aria-hidden="true"/);
  assert.match(layout, /metadataBase/);
  assert.match(layout, /\/og-v2\.png/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /@keyframes sword-crossing/);
  assert.match(css, /\.galaxy-ring-11/);
  assert.doesNotMatch(css, /border-(?:left|right)-color:\s*transparent/);
  assert.doesNotMatch(css, /\.cosmos-planet|\.cosmos-nebula/);
  assert.match(css, /\.scene-fallback/);
  assert.match(css, /\.game-fallback/);
  assert.doesNotMatch(cosmos, /MILKY WAY|EAU SECTOR 001|ORGANIC \+ MACHINE|cosmos-planet/);
  assert.match(cosmos, /length: 11/);
  assert.match(cosmos, /cosmos-orbit-four/);
  assert.match(cosmos, /<OrnateSword \/>/);
  assert.match(sword, /guard-flame-upper/);
  assert.match(sword, /ornate-sword-blade/);
  assert.match(babylon, /import \* as B from "@babylonjs\/core"/);
  assert.match(gameRuntime, /import Phaser from "phaser"/);
  assert.match(gameRuntime, /default: "arcade"/);
  assert.match(gameRuntime, /physics\.add\.overlap/);
  assert.match(gameRuntime, /addKeys/);
  assert.match(gameRuntime, /Keyboard\.JustDown/);
  assert.match(gameRuntime, /\["搜", "打", "割"\]/);
  assert.match(motion, /import \{ gsap \} from "gsap"/);
  assert.match(motion, /cursor-sword-anchor/);
  assert.match(motion, /Math\.atan2/);
  assert.match(motion, /gsap\.set\(sword, \{ x: event\.clientX, y: event\.clientY/);
  assert.doesNotMatch(page, /HUMAN SECTOR|CULTIVATION SECTOR|flight-courier/);
  assert.match(page, /flight-sword/);
  assert.match(game, /aria-pressed/);
  assert.doesNotMatch(babylon, /import\("@babylonjs/);
  assert.doesNotMatch(gameRuntime, /import\("phaser"\)/);
  assert.match(game, /ssr: false/);
  assert.doesNotMatch(motion, /import\("gsap/);
  assert.match(loaders, /import dynamic from "next\/dynamic"/);
  assert.match(loaders, /ssr: false/g);
  assert.match(packageJson, /"gsap": "3\.15\.0"/);
  assert.match(packageJson, /"@babylonjs\/core": "9\.21\.1"/);
  assert.match(packageJson, /"phaser": "4\.2\.1"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});

test("server-renders the digital card route", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("card", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(
    new Request("http://localhost/card", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Digital Card/);
  assert.match(html, /Save contact/);
  assert.match(html, /Eternal Amaris Universe/);
});
