import { glob } from "astro/loaders";
import { defineCollection, z } from "astro:content";
import { NEVER_PUBLIC_STATUSES } from "./lib/visibility";

/**
 * Public portfolio content. The product catalogue under `/universe/**` lives
 * in a separate private repository and must not be added here.
 *
 * Public portfolio = shipped work plus active projects Kevin chooses to show.
 * `portfolioVisible` is required and explicit on every entry, so a status
 * such as "in-progress" never publishes anything on its own, and paused or
 * archived entries can never be public. Source stays as history; to bring an
 * entry back, set an active status and `portfolioVisible: true`. Every public
 * query goes through `src/lib/portfolio.ts`.
 */

interface IssueSink {
  addIssue(issue: { code: "custom"; path: string[]; message: string }): void;
}

function checkVisibility(entry: { status: string; portfolioVisible: boolean; featured: boolean }, ctx: IssueSink) {
  const neverPublic = NEVER_PUBLIC_STATUSES.includes(entry.status);
  if (neverPublic && entry.portfolioVisible) {
    ctx.addIssue({ code: "custom", path: ["portfolioVisible"], message: `${entry.status} entries cannot be portfolio-visible` });
  }
  if (entry.featured && (!entry.portfolioVisible || neverPublic)) {
    ctx.addIssue({ code: "custom", path: ["featured"], message: "only public entries can be featured" });
  }
}

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
    status: z.enum(["delivered", "in-progress", "planned", "paused", "archived"]).default("delivered"),
    /** Same rule as games: explicit opt-in; paused and archived are never public. */
    portfolioVisible: z.boolean(),
    liveUrl: z.string().url().optional(),
    /** Which in-page line-art demo to mount. No company iframes. */
    demo: z.enum(["gamuda", "platform"]).optional(),
    order: z.number().default(99),
    featured: z.boolean().default(false),
  }).superRefine(checkVisibility),
});

const games = defineCollection({
  loader: glob({ base: "./src/content/games", pattern: "**/*.{md,mdx}" }),
  schema: ({ image }) => z.object({
    title: z.string(),
    /** `paused` / `archived`: not actively developed. Never public. */
    status: z.enum(["released", "in-development", "prototype", "paused", "archived"]),
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
    checkVisibility(game, ctx);
    if (game.cover && !game.coverAlt) {
      ctx.addIssue({ code: "custom", path: ["coverAlt"], message: "a cover image needs alt text" });
    }
  }),
});

export const collections = { work, games };
