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
  adapter: cloudflare({
    imageService: "compile",
  }),
  integrations: [react(), mdx(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
  build: {
    inlineStylesheets: "auto",
  },
});
