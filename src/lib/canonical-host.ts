export const CANONICAL_HOST = "eternalamarisuniverse.com";
const WWW_HOST = `www.${CANONICAL_HOST}`;

export function redirectToCanonicalHost(request: Request): Response | undefined {
  const url = new URL(request.url);
  const isApex = url.hostname === CANONICAL_HOST;
  const isWww = url.hostname === WWW_HOST;

  if (!isApex && !isWww) return undefined;
  if (isApex && url.protocol === "https:") return undefined;

  url.protocol = "https:";
  url.hostname = CANONICAL_HOST;
  url.port = "";

  return Response.redirect(url, 301);
}

/**
 * The private Universe Worker owns `/universe/*`, which deliberately does not
 * match the slashless root. Send that one URL to the private route while
 * preserving its query string.
 */
export function redirectUniverseRoot(request: Request): Response | undefined {
  const url = new URL(request.url);
  if (
    url.hostname !== CANONICAL_HOST ||
    url.protocol !== "https:" ||
    url.pathname !== "/universe"
  ) {
    return undefined;
  }

  url.pathname = "/universe/";
  return Response.redirect(url, 308);
}
