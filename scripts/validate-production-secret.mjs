import { readFile } from "node:fs/promises";

let source = "";
try {
  source = await readFile(new URL("../.env.production", import.meta.url), "utf8");
} catch {
  console.error("Production secret validation failed:");
  console.error("- create .env.production from .env.production.example");
  process.exit(1);
}

const entries = source
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"))
  .map((line) => {
    const separator = line.indexOf("=");
    return separator === -1
      ? [line, ""]
      : [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
  });

const failures = [];
const unexpectedKeys = entries
  .map(([key]) => key)
  .filter((key) => key !== "TURNSTILE_SECRET_KEY");
const secrets = entries
  .filter(([key]) => key === "TURNSTILE_SECRET_KEY")
  .map(([, value]) => value.replace(/^['"]|['"]$/g, ""));

if (unexpectedKeys.length > 0) {
  failures.push(".env.production may contain only TURNSTILE_SECRET_KEY");
}

if (secrets.length !== 1) {
  failures.push(".env.production must contain TURNSTILE_SECRET_KEY exactly once");
} else if (
  secrets[0].length < 20
  || secrets[0].includes("REPLACE_")
  || /^[123]x0{10,}/.test(secrets[0])
) {
  failures.push("TURNSTILE_SECRET_KEY must be a real production secret, not a placeholder or test key");
}

if (failures.length > 0) {
  console.error("Production secret validation failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log("Production secret file is ready.");
}
