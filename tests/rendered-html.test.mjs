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
  assert.match(html, /MILKY WAY \/\/ EAU SECTOR 001/);
  assert.match(html, /flying cultivation sword/i);
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

test("keeps the finished portfolio responsive and accessible", async () => {
  const [page, layout, css, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /aria-label="Primary navigation"/);
  assert.match(page, /<EAUCosmos \/>/);
  assert.doesNotMatch(page, /BabylonLineScene mode="hero"/);
  assert.match(page, /aria-hidden="true"/);
  assert.match(layout, /metadataBase/);
  assert.match(layout, /\/og-v2\.png/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /@keyframes sword-crossing/);
  assert.match(css, /\.cosmos-planet/);
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
