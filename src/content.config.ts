import { glob } from "astro/loaders";
import { defineCollection, z } from "astro:content";

/**
 * Public portfolio content. The product catalogue under `/universe/**` lives
 * in a separate private repository and must not be added here.
 */

const work = defineCollection({
  loader: glob({ base: "./src/content/work", pattern: "**/*.{md,mdx}" }),
  schema: z.object({
    title: z.string(),
    tagline: z.string(),
    summary: z.string(),
    eyebrow: z.string(),
    /** Headline outcome, e.g. "239.8 MB source model to 34.6 MB runtime". */
    result: z.string(),
    scope: z.array(z.string()),
    /**
     * Delivery state. Defaults to `delivered` so shipped entries need no change;
     * anything else renders a badge and keeps unfinished work honestly labelled.
     */
    status: z.enum(["delivered", "in-progress", "planned"]).default("delivered"),
    liveUrl: z.string().url().optional(),
    /** Which in-page line-art demo to mount. No company iframes. */
    demo: z.enum(["gamuda", "platform"]).optional(),
    order: z.number().default(99),
    featured: z.boolean().default(false),
  }),
});

const games = defineCollection({
  loader: glob({ base: "./src/content/games", pattern: "**/*.{md,mdx}" }),
  schema: z.object({
    title: z.string(),
    status: z.enum(["released", "in-development", "prototype"]),
    statusLabel: z.string(),
    platforms: z.array(z.string()),
    engine: z.string(),
    summary: z.string(),
    storeUrl: z.string().url().optional(),
    /** Playable Phaser vignette, booted on click only. */
    demo: z.enum(["system", "nasi", "infinity"]).optional(),
    order: z.number().default(99),
  }),
});

export const collections = { work, games };
