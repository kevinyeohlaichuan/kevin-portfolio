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
