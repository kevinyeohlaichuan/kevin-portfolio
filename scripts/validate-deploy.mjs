import { readFile } from "node:fs/promises";

const config = JSON.parse(await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
const siteKey = config.vars?.PUBLIC_TURNSTILE_SITE_KEY;
const emailBinding = config.send_email?.find((binding) => binding.name === "CONTACT_EMAIL");
const rateLimitBinding = config.ratelimits?.find((binding) => binding.name === "CONTACT_RATE_LIMITER");
const sessionBinding = config.kv_namespaces?.find((binding) => binding.binding === "SESSION");
const allowedHostnames = config.vars?.TURNSTILE_ALLOWED_HOSTNAMES ?? "";
const production = {
  workerName: "kevin-portfolio",
  workerEntrypoint: "./src/worker.ts",
  accountId: "883e6d04bf2265413c6c68073cdc4adc",
  siteKey: "0x4AAAAAAEVXQw_HdnxhCe4k",
  sessionNamespaceId: "f2abdb6750944b7f95479c8f71d7805b",
  rateLimitNamespaceId: "7382641",
  fromEmail: "contact@eternalamarisuniverse.com",
  toEmail: "spicymsgstudio@gmail.com",
};

const failures = [];

if (config.name !== production.workerName) {
  failures.push("Worker name must remain kevin-portfolio");
}

if (config.main !== production.workerEntrypoint) {
  failures.push("main must use the canonical-host-aware Worker entrypoint");
}

if (config.assets?.binding !== "ASSETS" || config.assets?.run_worker_first !== true) {
  failures.push("ASSETS must run the canonical-host Worker before serving static files");
}

if (config.account_id !== production.accountId) {
  failures.push("account_id must identify the production Cloudflare account");
}

if (siteKey !== production.siteKey) {
  failures.push("PUBLIC_TURNSTILE_SITE_KEY must be a real production widget key");
}

if (!emailBinding?.destination_address || !emailBinding?.allowed_sender_addresses?.length) {
  failures.push("CONTACT_EMAIL must restrict its destination and allowed sender");
}

if (config.vars?.CONTACT_TO_EMAIL !== emailBinding?.destination_address) {
  failures.push("CONTACT_TO_EMAIL must match the CONTACT_EMAIL destination");
}

if (config.vars?.CONTACT_TO_EMAIL !== production.toEmail) {
  failures.push("CONTACT_TO_EMAIL must remain the verified production destination");
}

if (!emailBinding?.allowed_sender_addresses?.includes(config.vars?.CONTACT_FROM_EMAIL)) {
  failures.push("CONTACT_FROM_EMAIL must be in CONTACT_EMAIL allowed_sender_addresses");
}

if (config.vars?.CONTACT_FROM_EMAIL !== production.fromEmail) {
  failures.push("CONTACT_FROM_EMAIL must remain the onboarded production sender");
}

if (!rateLimitBinding?.simple?.limit || !rateLimitBinding?.simple?.period) {
  failures.push("CONTACT_RATE_LIMITER must be configured");
}

if (rateLimitBinding?.namespace_id !== production.rateLimitNamespaceId) {
  failures.push("CONTACT_RATE_LIMITER must use the production namespace");
}

if (sessionBinding?.id !== production.sessionNamespaceId) {
  failures.push("SESSION must be pinned to the provisioned Cloudflare KV namespace");
}

if (!config.vars?.CONTACT_FROM_EMAIL || !config.vars?.CONTACT_TO_EMAIL) {
  failures.push("contact sender and destination variables must be configured");
}

const hostnameRules = allowedHostnames.split(",").map((hostname) => hostname.trim()).filter(Boolean);
const normalizedHostnameRules = hostnameRules.map((hostname) => hostname.toLowerCase());
const expectedHostnames = [
  "eternalamarisuniverse.com",
  "www.eternalamarisuniverse.com",
  "kevin-portfolio.kevinyeohlaichuan5385.workers.dev",
  "staging-kevin-portfolio.kevinyeohlaichuan5385.workers.dev",
];
const expectedRoutes = [
  "eternalamarisuniverse.com/*",
  "www.eternalamarisuniverse.com/*",
];
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

if (
  normalizedHostnameRules.length !== expectedHostnames.length
  || expectedHostnames.some((hostname) => !normalizedHostnameRules.includes(hostname))
) {
  failures.push("TURNSTILE_ALLOWED_HOSTNAMES must match the production widget hostname allowlist");
}

const configuredRoutes = config.routes ?? [];
if (
  configuredRoutes.length !== expectedRoutes.length
  || expectedRoutes.some((pattern) => !configuredRoutes.some((route) => (
    route.pattern === pattern && route.zone_name === "eternalamarisuniverse.com"
  )))
) {
  failures.push("routes must attach both the apex and www hosts to the production Worker");
}

if (failures.length > 0) {
  console.error("Deployment configuration is incomplete:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log("Deployment configuration is ready.");
}
