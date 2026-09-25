import { getCollection, type CollectionEntry } from "astro:content";
import { isPublicData } from "./visibility";

/**
 * The only way public pages read the `games` and `work` collections. Routes,
 * lists, the command palette, RSS and the homepage all go through here, so a
 * hidden, paused or archived entry cannot leak through a page that forgot to
 * filter. A test rejects direct `getCollection("games" | "work")` calls
 * anywhere else.
 */
export type Game = CollectionEntry<"games">;
export type Work = CollectionEntry<"work">;

/** Public = explicitly opted in and not paused/archived. Status alone never publishes. */
export const isPublicGame = (game: Game): boolean => isPublicData(game.data);
export const isPublicWork = (entry: Work): boolean => isPublicData(entry.data);

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

export async function getPublicWork(): Promise<Work[]> {
  const work = await getCollection("work", isPublicWork);
  return work.sort((a, b) => a.data.order - b.data.order);
}

/** The homepage professional case studies: public and featured, in order. */
export async function getFeaturedWork(): Promise<Work[]> {
  return (await getPublicWork()).filter((entry) => entry.data.featured);
}
