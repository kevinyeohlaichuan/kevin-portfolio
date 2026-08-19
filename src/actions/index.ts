import { env } from "cloudflare:workers";
import { ActionError, defineAction } from "astro:actions";
import { contactInputSchema } from "../lib/contact-schema";

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const TOPIC_LABELS = {
  employment: "Employment",
  collaboration: "Project collaboration",
  press: "Press and media",
  other: "Other",
} as const;

interface ContactEmailBinding {
  send(message: {
    to: string;
    from: string | { email: string; name?: string };
    subject: string;
    text: string;
    replyTo?: string | { email: string; name?: string };
  }): Promise<{ messageId: string }>;
}

interface ContactRateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

interface ContactRuntimeEnv {
  CONTACT_EMAIL?: ContactEmailBinding;
  CONTACT_RATE_LIMITER?: ContactRateLimiter;
  CONTACT_FROM_EMAIL?: string;
  CONTACT_TO_EMAIL?: string;
  TURNSTILE_ALLOWED_HOSTNAMES?: string;
  TURNSTILE_SECRET_KEY?: string;
}

interface TurnstileResult {
  success: boolean;
  action?: string;
  hostname?: string;
  metadata?: {
    result_with_testing_key?: boolean;
  };
  "error-codes"?: string[];
}

type TurnstileVerification = "valid" | "invalid" | "unavailable";

const cleanHeaderValue = (value: string) => value.replace(/[\r\n]+/g, " ").trim();

const hostnameMatches = (hostname: string, rule: string) => {
  const normalizedRule = rule.trim().toLowerCase();
  const normalizedHostname = hostname.toLowerCase();

  if (normalizedRule.startsWith("*.")) {
    return normalizedHostname.endsWith(normalizedRule.slice(1));
  }

  return normalizedHostname === normalizedRule;
};

const verifyTurnstile = async ({
  token,
  secret,
  remoteIp,
  allowedHostnames,
  testMode,
}: {
  token: string;
  secret: string;
  remoteIp?: string;
  allowedHostnames: string[];
  testMode: boolean;
}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret,
        response: token,
        remoteip: remoteIp,
      }),
      signal: controller.signal,
    });

    if (!response.ok) return "unavailable" satisfies TurnstileVerification;

    const result = (await response.json()) as TurnstileResult;
    const unavailableCodes = new Set([
      "bad-request",
      "internal-error",
      "invalid-input-secret",
      "missing-input-response",
      "missing-input-secret",
    ]);
    if (result["error-codes"]?.some((code) => unavailableCodes.has(code))) {
      return "unavailable";
    }

    if (testMode && result.metadata?.result_with_testing_key) {
      return result.success ? "valid" : "invalid";
    }

    const hostnameAllowed = Boolean(
      result.hostname && allowedHostnames.some((rule) => hostnameMatches(result.hostname!, rule)),
    );

    return result.success && result.action === "contact" && hostnameAllowed
      ? "valid"
      : "invalid";
  } catch {
    return "unavailable";
  } finally {
    clearTimeout(timeout);
  }
};

export const server = {
  submitContact: defineAction({
    accept: "form",
    input: contactInputSchema,
    handler: async (input, context) => {
      // Bots commonly fill hidden fields. Report success without spending a
      // Turnstile request or sending mail, so the trap is not discoverable.
      if (input.website) return { delivered: true };

      const runtimeEnv = env as unknown as ContactRuntimeEnv;
      const rateLimiter = runtimeEnv.CONTACT_RATE_LIMITER;
      const secret = runtimeEnv.TURNSTILE_SECRET_KEY;
      const allowedHostnames = runtimeEnv.TURNSTILE_ALLOWED_HOSTNAMES
        ?.split(",")
        .map((hostname) => hostname.trim())
        .filter(Boolean) ?? [];
      if (import.meta.env.DEV) {
        allowedHostnames.push("localhost", "127.0.0.1");
      }

      if (!input["cf-turnstile-response"]) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: "Verification is required.",
        });
      }

      if (!rateLimiter || !secret || allowedHostnames.length === 0) {
        context.logger.error("Contact backend is missing its Turnstile configuration.");
        throw new ActionError({
          code: "SERVICE_UNAVAILABLE",
          message: "The contact service is temporarily unavailable.",
        });
      }

      const requester = context.request.headers.get("CF-Connecting-IP")?.trim() || "unknown";
      const actorBytes = new TextEncoder().encode(requester);
      const actorHash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", actorBytes))]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
      let rateLimit: { success: boolean };
      try {
        rateLimit = await rateLimiter.limit({ key: actorHash });
      } catch {
        context.logger.error("Contact rate limiter is unavailable.");
        throw new ActionError({
          code: "SERVICE_UNAVAILABLE",
          message: "The contact service is temporarily unavailable.",
        });
      }

      if (!rateLimit.success) {
        throw new ActionError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many messages were submitted. Please wait a minute and try again.",
        });
      }

      const verification = await verifyTurnstile({
        token: input["cf-turnstile-response"],
        secret,
        remoteIp: requester === "unknown" ? undefined : requester,
        allowedHostnames,
        testMode: import.meta.env.DEV,
      });

      if (verification === "unavailable") {
        context.logger.error("Turnstile verification is unavailable.");
        throw new ActionError({
          code: "SERVICE_UNAVAILABLE",
          message: "The contact service is temporarily unavailable.",
        });
      }

      if (verification === "invalid") {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: "Verification failed or expired. Please try again.",
        });
      }

      const emailBinding = runtimeEnv.CONTACT_EMAIL;
      const from = runtimeEnv.CONTACT_FROM_EMAIL;
      const to = runtimeEnv.CONTACT_TO_EMAIL;

      if (!emailBinding || !from || !to) {
        context.logger.error("Contact backend is missing its email configuration.");
        throw new ActionError({
          code: "SERVICE_UNAVAILABLE",
          message: "The contact service is temporarily unavailable.",
        });
      }

      const name = cleanHeaderValue(input.name);
      const topic = TOPIC_LABELS[input.topic];

      try {
        await emailBinding.send({
          to,
          from: { email: from, name: "Kevin Yeoh Portfolio" },
          replyTo: { email: input.email, name },
          subject: `[Portfolio] ${topic} from ${name}`,
          text: [
            `Name: ${name}`,
            `Email: ${input.email}`,
            `Topic: ${topic}`,
            "",
            input.message,
          ].join("\n"),
        });
      } catch (error) {
        const code = error && typeof error === "object" && "code" in error
          ? String(error.code)
          : "unknown";
        context.logger.error(`Contact email delivery failed (${code}).`);
        throw new ActionError({
          code: "SERVICE_UNAVAILABLE",
          message: "The message could not be delivered. Please use the email link instead.",
        });
      }

      return { delivered: true };
    },
  }),
};
