import { readFile } from "node:fs/promises";

const config = JSON.parse(await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
const siteKey = config.vars?.PUBLIC_TURNSTILE_SITE_KEY;
const emailBinding = config.send_email?.find((binding) => binding.name === "CONTACT_EMAIL");
const rateLimitBinding = config.ratelimits?.find((binding) => binding.name === "CONTACT_RATE_LIMITER");
const allowedHostnames = config.vars?.TURNSTILE_ALLOWED_HOSTNAMES ?? "";

const failures = [];

if (!siteKey || siteKey === "REPLACE_BEFORE_DEPLOY" || /^[123]x0{10,}/.test(siteKey)) {
  failures.push("PUBLIC_TURNSTILE_SITE_KEY must be a real production widget key");
}

if (!emailBinding?.destination_address || !emailBinding?.allowed_sender_addresses?.length) {
  failures.push("CONTACT_EMAIL must restrict its destination and allowed sender");
}

if (config.vars?.CONTACT_TO_EMAIL !== emailBinding?.destination_address) {
  failures.push("CONTACT_TO_EMAIL must match the CONTACT_EMAIL destination");
}

if (!emailBinding?.allowed_sender_addresses?.includes(config.vars?.CONTACT_FROM_EMAIL)) {
  failures.push("CONTACT_FROM_EMAIL must be in CONTACT_EMAIL allowed_sender_addresses");
}

if (!rateLimitBinding?.simple?.limit || !rateLimitBinding?.simple?.period) {
  failures.push("CONTACT_RATE_LIMITER must be configured");
}

if (!config.vars?.CONTACT_FROM_EMAIL || !config.vars?.CONTACT_TO_EMAIL) {
  failures.push("contact sender and destination variables must be configured");
}

const hostnameRules = allowedHostnames.split(",").map((hostname) => hostname.trim()).filter(Boolean);
const normalizedHostnameRules = hostnameRules.map((hostname) => hostname.toLowerCase());
if (
  hostnameRules.length === 0
  || hostnameRules.some((hostname, index) => hostname !== normalizedHostnameRules[index])
  || hostnameRules.some((hostname) =>
    hostname.includes("REPLACE_")
    || hostname.includes("*")
    || hostname === "localhost"
    || hostname === "127.0.0.1"
  )
) {
  failures.push("TURNSTILE_ALLOWED_HOSTNAMES must contain production hostnames only, without placeholders or wildcards");
}

if (!normalizedHostnameRules.includes("eternalamarisuniverse.com")) {
  failures.push("TURNSTILE_ALLOWED_HOSTNAMES must include eternalamarisuniverse.com");
}

if (!normalizedHostnameRules.some((hostname) => hostname.endsWith(".workers.dev"))) {
  failures.push("TURNSTILE_ALLOWED_HOSTNAMES must include the exact workers.dev hostname");
}

if (!normalizedHostnameRules.some((hostname) => /^kevin-portfolio\.[a-z0-9-]+\.workers\.dev$/.test(hostname))) {
  failures.push("TURNSTILE_ALLOWED_HOSTNAMES must include kevin-portfolio.<account>.workers.dev");
}

if (!normalizedHostnameRules.some((hostname) => /^staging-kevin-portfolio\.[a-z0-9-]+\.workers\.dev$/.test(hostname))) {
  failures.push("TURNSTILE_ALLOWED_HOSTNAMES must include staging-kevin-portfolio.<account>.workers.dev");
}

if (failures.length > 0) {
  console.error("Deployment configuration is incomplete:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log("Deployment configuration is ready.");
}
