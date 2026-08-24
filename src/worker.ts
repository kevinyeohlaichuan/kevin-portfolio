import { handle } from "@astrojs/cloudflare/handler";
import { redirectToCanonicalHost, redirectUniverseRoot } from "./lib/canonical-host";

export default {
  async fetch(request, env, context) {
    const redirect = redirectToCanonicalHost(request);
    if (redirect) return redirect;

    const universeRedirect = redirectUniverseRoot(request);
    if (universeRedirect) return universeRedirect;

    return handle(request, env, context);
  },
} satisfies ExportedHandler<Env>;
