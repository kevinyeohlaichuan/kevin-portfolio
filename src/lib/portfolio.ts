import { getCollection, type CollectionEntry } from "astro:content";

/**
 * The only way public pages read the games collection. Routes, lists, the
 * command palette, RSS and the homepage all go through here, so a hidden or
 * archived entry cannot leak through a page that forgot to filter. A test
 * rejects direct `getCollection("games")` calls anywhere else.
 */
export type Game = CollectionEntry<"games">;

/** Public = explicitly opted in and not archived. Status alone never publishes. */
export const isPublicGame = (game: Game): boolean =>
  game.data.portfolioVisible && game.data.status !== "archived";

export async function getPublicGames(): Promise<Game[]> {
  const games = await getCollection("games", isPublicGame);
  return games.sort((a, b) => a.data.order - b.data.order);
}

/** The homepage "Current games" row: public, featured, in featuredOrder. */
export async function getFeaturedGames(limit = 3): Promise<Game[]> {
  const games = await getPublicGames();
  return games
    .filter((game) => game.data.featured)
    .sort((a, b) => a.data.featuredOrder - b.data.featuredOrder)
    .slice(0, limit);
}
