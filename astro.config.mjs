// @ts-check
import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

// Server output, not static. Pages opt into prerendering individually via
// `export const prerender = true`, so nothing about growing into a real
// application is foreclosed by the build mode.
export default defineConfig({
  site: "https://eternalamarisuniverse.com",
  output: "server",
  security: {
    actionBodySizeLimit: 32 * 1024,
  },
  adapter: cloudflare({
    imageService: "compile",
    // Prerendering does not need a local inspector. Keeping it disabled also
    // makes builds work in restricted CI/container environments.
    inspectorPort: false,
  }),
  integrations: [react(), mdx(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      dedupe: ["react", "react-dom"],
    },
    // Phaser already owns its browser bundle. Vite's dev pre-bundler can
    // invalidate that cached chunk while this click-loaded island is idle.
    optimizeDeps: {
      exclude: ["phaser"],
    },
  },
  build: {
    inlineStylesheets: "auto",
  },
});
