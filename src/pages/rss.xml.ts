import type { APIContext } from "astro";
import { getCollection } from "astro:content";

export const prerender = true;

/**
 * Hand-rolled rather than via @astrojs/rss: that package pulls fast-xml-parser,
 * which throws inside the Cloudflare prerenderer ("_function(...).returns is not
 * a function"). RSS is a small, stable format — owning these 25 lines costs less
 * than carrying a dependency that breaks on the deploy target.
 */

const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

interface FeedItem {
  title: string;
  description: string;
  link: string;
  category: string;
}

export async function GET(context: APIContext) {
  const site = context.site!;
  const [work, games, universe] = await Promise.all([
    getCollection("work"),
    getCollection("games"),
    getCollection("universe"),
  ]);

  const items: FeedItem[] = [
    ...work.map((entry) => ({
      title: entry.data.title,
      description: entry.data.summary,
      link: new URL(`/work/${entry.id}/`, site).href,
      category: "Professional work",
    })),
    ...games.map((entry) => ({
      title: entry.data.title,
      description: entry.data.summary,
      link: new URL(`/games/${entry.id}/`, site).href,
      category: "Games",
    })),
    ...universe
      .filter((entry) => !entry.data.draft)
      .map((entry) => ({
        title: entry.data.title,
        description: entry.data.summary,
        link: new URL(`/universe/${entry.id}/`, site).href,
        category: "Eternal Amaris Universe",
      })),
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Kevin Yeoh — Eternal Amaris Universe</title>
    <link>${escapeXml(site.href)}</link>
    <description>Architectural visualisation, interactive 3D systems, games and the Eternal Amaris Universe.</description>
    <language>en</language>
    <atom:link href="${escapeXml(new URL("/rss.xml", site).href)}" rel="self" type="application/rss+xml" />
${items
  .map(
    (item) => `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.link)}</link>
      <guid isPermaLink="true">${escapeXml(item.link)}</guid>
      <description>${escapeXml(item.description)}</description>
      <category>${escapeXml(item.category)}</category>
    </item>`,
  )
  .join("\n")}
  </channel>
</rss>
`;

  return new Response(body, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
