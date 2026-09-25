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

/**
 * Public portfolio = shipped work plus active projects Kevin chooses to show.
 * `portfolioVisible` is required and explicit, so a status such as
 * "in-development" never publishes an entry on its own: experiments, paused
 * and retired prototypes stay in the repository as history without
 * cluttering the site. Every public query goes through `src/lib/portfolio.ts`.
 */
const games = defineCollection({
  loader: glob({ base: "./src/content/games", pattern: "**/*.{md,mdx}" }),
  schema: ({ image }) => z.object({
    title: z.string(),
    /** `archived`: no longer developed. Never public, whatever else is set. */
    status: z.enum(["released", "in-development", "prototype", "archived"]),
    portfolioVisible: z.boolean(),
    /** Homepage "Current games" row, in `featuredOrder`. Must be public. */
    featured: z.boolean().default(false),
    featuredOrder: z.number().default(99),
    /** Real screenshot for the lead homepage card. Needs `coverAlt`. */
    cover: image().optional(),
    coverAlt: z.string().optional(),
    statusLabel: z.string(),
    platforms: z.array(z.string()),
    engine: z.string(),
    summary: z.string(),
    storeUrl: z.string().url().optional(),
    /**
     * A playable build hosted on its own site. Linked out like every other
     * product, never embedded, so the game ships and deploys independently.
     */
    liveDemoUrl: z.string().url().optional(),
    /** Playable Phaser vignette, booted on click only. */
    demo: z.enum(["system", "nasi", "infinity"]).optional(),
    order: z.number().default(99),
  }).superRefine((game, ctx) => {
    if (game.status === "archived" && game.portfolioVisible) {
      ctx.addIssue({ code: "custom", path: ["portfolioVisible"], message: "archived games cannot be portfolio-visible" });
    }
    if (game.featured && (!game.portfolioVisible || game.status === "archived")) {
      ctx.addIssue({ code: "custom", path: ["featured"], message: "only public games can be featured" });
    }
    if (game.cover && !game.coverAlt) {
      ctx.addIssue({ code: "custom", path: ["coverAlt"], message: "a cover image needs alt text" });
    }
  }),
});

export const collections = { work, games };
