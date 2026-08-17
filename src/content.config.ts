import { glob } from "astro/loaders";
import { defineCollection, z } from "astro:content";

/**
 * Three collections, one shape each. Adding a work project, a game or a piece of
 * universe writing means adding a file — never editing a page.
 *
 * `universe` is deliberately flat. Entries carry a `kind` so factions,
 * characters and worlds can split into their own routes later, but none of
 * that structure gets built until there is enough writing to justify it.
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

const universe = defineCollection({
  loader: glob({ base: "./src/content/universe", pattern: "**/*.{md,mdx}" }),
  schema: z.object({
    title: z.string(),
    kind: z.enum(["faction", "character", "world", "artifact", "concept"]),
    summary: z.string(),
    /** Slugs of related entries. Wiki-style links without a wiki. */
    related: z.array(z.string()).default([]),
    order: z.number().default(99),
    draft: z.boolean().default(false),
  }),
});

export const collections = { work, games, universe };
