import { handle } from "@astrojs/cloudflare/handler";
import { redirectToCanonicalHost } from "./lib/canonical-host";

export default {
  async fetch(request, env, context) {
    const redirect = redirectToCanonicalHost(request);
    if (redirect) return redirect;

    return handle(request, env, context);
  },
} satisfies ExportedHandler<Env>;
