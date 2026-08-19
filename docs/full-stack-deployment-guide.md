# Portfolio full-stack and deployment guide

This is the short, honest explanation of how the portfolio works, followed by
the detailed record of what was built and deployed on 19 August 2026.

## 讲重点: the whole flow

```text
You edit the Astro/React project
            ↓
`npm run dev` shows it locally
            ↓
`npm test` builds and checks the site
            ↓
`npm run deploy` builds and uploads a Cloudflare Worker
            ↓
Visitor enters eternalamarisuniverse.com
            ↓
Gandi confirms who owns the domain
            ↓
Cloudflare DNS points the visitor to Cloudflare
            ↓
Cloudflare provides HTTPS and runs the Worker
            ↓
Most pages return prebuilt frontend files
Contact submissions run the server-side backend and send email
```

The one-sentence version is:

> This is an Astro full-stack portfolio deployed as a Cloudflare Worker. Most
> pages are prerendered for speed, React is used only for interactive parts,
> and the contact form uses a validated server action protected by Turnstile
> and rate limiting before Cloudflare sends it to a fixed inbox. Gandi remains
> the registrar, while Cloudflare handles DNS, HTTPS, hosting and the backend.

## What each company or tool does

Think of the domain as a shop:

| Part | Shop analogy | This project |
| --- | --- | --- |
| Registrar | The land title office | Gandi records that Kevin owns `eternalamarisuniverse.com` and handles renewal. |
| DNS | The address directory | Cloudflare DNS tells browsers where the domain should go. |
| Hosting/runtime | The building and staff | Cloudflare Workers serves the site and runs backend code. |
| HTTPS/TLS | The locked, verified entrance | Cloudflare issues and serves the certificate. |
| Source control | The construction record | GitHub stores the code and commit history. It is not the current host. |

Changing Gandi's nameservers to Cloudflare was a **DNS cutover**, not a domain
registration transfer. Gandi still owns the billing relationship. Cloudflare
already provides the live DNS and application services.

## What we built

### Frontend

- Astro 7 owns routing, page templates, metadata, sitemap, RSS and production
  builds.
- React 19 is used only for interactive islands, so normal pages do not ship a
  full React application unnecessarily.
- Content collections hold work, game and universe entries as typed content.
- Babylon.js provides the 3D scenes, Phaser provides playable game vignettes,
  and GSAP provides selected motion.
- The main routes are `/`, `/work`, `/games`, `/universe`, `/about`, `/card`,
  `/contact` and `/time-machine`.
- The old GitHub Pages site is preserved in the time-machine archive rather
  than being silently lost.

Most routes are **prerendered** during the build. That means Cloudflare can
return ready-made HTML, CSS, JavaScript and images very quickly. The project is
still configured as a server application, so server features can be added
without rebuilding the architecture from zero.

### Backend

The backend is intentionally small but real. It currently exists for the
contact form; there is no login system, CMS or application database yet.

When a visitor submits `/contact`:

1. Astro sends the form to a server-side Action running in the Cloudflare
   Worker.
2. Zod validates the name, email, topic, message and hidden honeypot field.
3. A bot that fills the honeypot is quietly discarded.
4. The Worker hashes the Cloudflare visitor IP and applies the native rate
   limit: five attempts per minute per IP.
5. The Worker asks Cloudflare Turnstile to verify the token, expected action
   and exact hostname.
6. The email binding sends a plain-text message from the fixed portfolio
   sender to the fixed verified Gmail destination.
7. The visitor's email is used only as `Reply-To`; visitors cannot choose the
   sender or recipient headers.
8. The page shows a separate delivery result, so Turnstile's green success is
   not confused with successful email delivery.

The form also has safe error handling, an email-link fallback, a 32 KiB action
body limit, responsive Turnstile rendering and SPA-navigation cleanup.

Current limitation: delivery is at-least-once. In the rare case where a
network response is lost after the email was accepted, retrying may produce a
duplicate. Avoiding that would require persistent deduplication storage.

### Cloudflare runtime configuration

`wrangler.jsonc` connects the Worker to:

- the apex and `www` production routes;
- the custom Worker entrypoint that redirects HTTP and `www` to the canonical
  HTTPS apex;
- static assets;
- the Turnstile public configuration and secret requirement;
- the contact rate limiter;
- the fixed-destination email binding; and
- a pinned `SESSION` KV namespace for Astro server sessions as the application
  grows.

Secrets are not committed. The real Turnstile secret lives in the ignored
`.env.production` file and in Cloudflare's deployed secret configuration.

## What happened during deployment

### 1. Local development was repaired

Astro reported that another development server was already running. That same
process held the native Lightning CSS file open, so `npm ci` failed with a
Windows `EPERM` error and Vite's optimized-dependency cache became incomplete.

The rule for this repository is:

```bash
npx astro dev stop
npm ci
npm run dev
```

If Astro already prints a working URL, use that URL instead of starting a
second server. Stop the server before reinstalling dependencies on Windows.

### 2. The backend was designed and hardened

The initial site had no runtime API, database, authentication or form
processing. The smallest useful backend was the contact form, rather than
adding a database or CMS with no product requirement.

During review we fixed real failure cases: empty optional form values, missing
Cloudflare client addresses during local development, one-use Turnstile token
resetting, SPA navigation lifecycle, mobile widget width, upstream timeouts,
safe client-facing errors and rate limiting by IP rather than a user-controlled
email address.

### 3. Deployment safety was added

The deploy scripts now fail before upload if the production account, routes,
hostnames, email destination, rate limiter, KV binding or Turnstile secret are
wrong. The secret validator rejects placeholders and Cloudflare test keys.

The custom Worker entrypoint performs the canonical redirect before Astro or
static assets handle the request. This makes `www` redirect correctly even for
prerendered pages.

### 4. Cloudflare services were configured

- Signed in to Cloudflare and selected the Free zone plan.
- Created and deployed the `kevin-portfolio` Worker.
- Configured the production and staging Worker hostnames.
- Created the Turnstile widget and its exact allowed hostnames.
- Provisioned the rate-limit binding and Astro `SESSION` KV namespace.
- Enabled Email Routing, verified `spicymsgstudio@gmail.com`, and configured
  `contact@eternalamarisuniverse.com`.
- Stored the production Turnstile secret outside Git.
- Verified real contact delivery on the Worker URL and public domain.

### 5. DNS was cut over from Gandi to Cloudflare

The existing DNS records were copied into Cloudflare, including the Google
verification TXT record. Gandi's authoritative nameservers were then changed
to the two Cloudflare nameservers.

The public result is now:

- Gandi: registrar and renewal;
- Cloudflare: authoritative DNS, TLS, Worker routes and backend services;
- GitHub Pages records: retained behind Cloudflare as a rollback origin;
- `eternalamarisuniverse.com`: production Worker;
- `www.eternalamarisuniverse.com`: permanent redirect to the HTTPS apex.

### 6. The QUIC cutover incident was fixed

Immediately after the nameserver change, Windows and Chrome had a mixture of
old GitHub/Gandi DNS and new Cloudflare DNS. Chrome also remembered the old
HTTP/3 advertisement, producing `ERR_QUIC_PROTOCOL_ERROR` even though the
Worker and TLS certificate were healthy.

We flushed the Windows DNS cache and temporarily disabled HTTP/3 in Cloudflare.
The domain then loaded in Chrome over HTTP/2. Public resolvers agreed on the
Cloudflare IPv4/IPv6 records, the apex returned `200`, `www` returned `301`, and
TLS validated. HTTP/3 should remain off until the old 24-hour browser
advertisement cache has expired, then be re-enabled only with another test.

## Why Cloudflare Free is enough now

This portfolio is a very good Free-plan workload:

- most requests return prerendered static assets;
- the only dynamic backend is a short contact submission;
- there are no expensive reports, uploads, video processing or long database
  operations;
- traffic is far below the Workers Free limit of 100,000 Worker requests per
  day;
- Turnstile Free allows unlimited challenges, up to 20 widgets and 10
  hostnames per widget; this project uses one widget and four hostnames;
- sending to the one verified Gmail destination is free; and
- the Free zone includes baseline DDoS protection and a Free managed WAF
  ruleset.

Current official references:

- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Turnstile plans](https://developers.cloudflare.com/turnstile/plans/)
- [Email Service pricing](https://developers.cloudflare.com/email-service/platform/pricing/)
- [Free WAF ruleset](https://developers.cloudflare.com/waf/get-started/)

There are two different upgrade decisions:

1. **Workers Free → Workers Paid** upgrades application compute. Consider it
   when dynamic traffic approaches 100,000 requests per day, backend work needs
   more than the Free CPU allowance, the app grows into heavier database or API
   processing, or email must be sent to arbitrary recipients. Workers Paid
   currently has a USD 5 monthly minimum plus usage beyond its included quota.
2. **Cloudflare zone Free → Pro/Business** upgrades domain-level security,
   performance and support features. Consider it for a business-critical site
   that needs the full managed WAF, more advanced bot controls/rules, stronger
   analytics/alerts or paid support. A normal increase in portfolio visitors is
   not, by itself, a reason to buy Pro.

Do not upgrade because a plan sounds more professional. Upgrade when metrics or
a concrete product requirement cross a documented Free-plan boundary.

## Should the registrar move from Gandi to Cloudflare?

Not yet, and it is not required for the website to work. The important DNS
cutover is already complete.

Recommended timing:

1. Leave the live site stable on Cloudflare DNS for at least one to two weeks.
2. Confirm email forwarding, contact delivery, redirects and renewal contact
   details again.
3. When ready, unlock the domain at Gandi and request its EPP/auth code.
4. Start the transfer from Cloudflare Registrar and approve the Gandi email.
5. Keep access to both accounts until Cloudflare reports the transfer complete.

As of 19 August 2026, registry data shows the domain expires on 19 January 2027
and has `client transfer prohibited`, which is the normal registrar lock that
must be removed before transfer. There is no renewal emergency.

Cloudflare requires the domain to be active on its full DNS setup before a
registrar transfer—this part is already satisfied. It also requires a valid
payment method, no registration/transfer/registrant-change lock within the
previous 60 days, and an unlocked domain. Cloudflare says active work is about
30 minutes but total completion can take up to 10 days; most `.com` transfers
also add one registration year. See the official [registrar transfer
guide](https://developers.cloudflare.com/registrar/get-started/transfer-domain-to-cloudflare/).

Reasons to transfer later:

- Cloudflare Registrar sells domains at registry/ICANN cost without a markup;
- DNS, hosting and renewal would be in one account; and
- there would be one fewer vendor and dashboard to maintain.

Reasons to keep Gandi:

- it is already working and separating registrar from hosting reduces the
  blast radius of one account problem;
- Gandi support or domain-management features may be valuable; and
- Cloudflare Registrar requires Cloudflare authoritative DNS while the domain
  remains registered there.

This is an operational preference, not a technical blocker. Revisit it after
the deployment has been boring and stable, not during the cutover day.

## How to deploy the next change

### One-time setup on a new computer

```bash
npm ci
npx wrangler login
cp .env.production.example .env.production
```

Put the real production `TURNSTILE_SECRET_KEY` in `.env.production`. Never
commit or paste that secret into `wrangler.jsonc`, a screenshot or chat.

### Normal change: the practical routine

```bash
npm run dev
```

Review the change locally. Then stop the dev server if a dependency install is
needed, and run:

```bash
npm run check
npm run lint
npm test
npm run deploy
```

Finally open these in a browser:

- `https://eternalamarisuniverse.com/`
- the page that changed;
- `/contact` if frontend routing, backend or Cloudflare configuration changed;
- `https://www.eternalamarisuniverse.com/test-path` to confirm the redirect
  after any Worker entrypoint or domain change.

Then commit and push the source code. Deployment and Git are separate:

- `npm run deploy` publishes the built application to Cloudflare;
- `git push` publishes the source history to GitHub.

Your senior's “just run `npm run deploy`” advice is correct when a project has
already encoded all of its build and hosting details in that script. In this
repository, `npm run deploy` is intentionally more than a raw upload. It runs
the production configuration and secret checks, builds Astro, and calls
Wrangler with the production secret file.

### Safer routine for backend, DNS or risky changes

```bash
npm run deploy:dry
npm run deploy:preview
```

Test the staging URL printed by Wrangler. If the exact uploaded version is
good, promote its version ID:

```bash
npm run deploy:promote -- <VERSION_ID>@100% -y
```

Use direct `npm run deploy` for normal content, layout and low-risk fixes after
tests pass. Use preview and promotion when changing contact behavior, Worker
routing, secrets, bindings or other infrastructure.

## How to explain your role honestly

Do not say “AI made everything,” but do not pretend no tools were used. A good
professional description is:

> I designed the portfolio's product direction, information architecture,
> visual priorities and content. I chose and reviewed the full-stack shape,
> directed an AI-assisted implementation, tested the actual user flows, set up
> the Cloudflare services, performed the Gandi DNS cutover and shipped it. AI
> accelerated coding and review; I owned the decisions, integration, QA and
> deployment.

If someone wants the technical version:

> It is an Astro application with mostly prerendered routes and small React
> islands, deployed on Cloudflare Workers. The contact form is a server-side
> Astro Action with schema validation, a honeypot, Turnstile, IP rate limiting
> and a fixed-destination email binding. Gandi remains the registrar, while
> Cloudflare handles authoritative DNS, TLS and the runtime.

The important skill is not typing every character manually. It is being able
to explain the architecture, inspect failures, make trade-offs, test the real
result and safely operate production. Those are the parts to keep practising.
