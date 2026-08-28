# artneroza.com

Personal site for **Art C. Neroza** — Full-Stack Developer & HubSpot Administrator.

A deliberately small static site: one page, no framework runtime, ~6 KB over the wire.
Built with [Astro](https://astro.build) in static mode and deployed to Vercel.

---

## Quick start

Requires **Node 18.20.8+ / 20.3+ / 22+** (developed on Node 20.17.0).

```bash
npm install
npm run dev        # http://localhost:4321
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server with HMR |
| `npm run build` | Static build into `dist/` |
| `npm run preview` | Serve `dist/` exactly as production will |

Always sanity-check with `build` + `preview` before pushing — `dev` does not
apply the production HTML minification or stylesheet inlining.

---

## Project layout

```
astro.config.mjs        site URL, sitemap, stylesheet inlining
public/                 copied verbatim into dist/
  og.png                1200x630 social card
  robots.txt
src/
  data/projects.ts      ← all card content lives here
  components/
    Card.astro          one card, used by both the grid and the rail
    Rail.astro          "Recents" carousel + its inline JS
  layouts/
    Base.astro          <head>, meta, Open Graph, JSON-LD
  pages/
    index.astro         the page itself
  fonts/                self-hosted woff2, latin subset
  styles/
    global.css          @font-face + all CSS (intentionally global)
backup/                 the original hand-written single-file version
```

---

## Editing content

### Adding or changing a project

Everything on the page comes from [`src/data/projects.ts`](src/data/projects.ts).
You should not need to touch a component to add work.

```ts
export type Project = {
  name: string;
  stack: string;
  url?: string;   // omit for a non-interactive card
  year?: string;  // shown on the Recents rail only
};
```

Two exported arrays:

- **`featured`** — the 2x2 grid under the masthead. Capability statements.
- **`recents`** — the horizontally scrolling "Recents" rail.

```ts
export const recents: Project[] = [
  { name: "Eternal Homes", stack: "Custom WP · Gutenberg", url: "https://eternalhomes.com.au/", year: "2025" },
];
```

**`url` is optional and it changes the rendered markup.** With a `url`, the card
renders as `<a target="_blank" rel="noopener">` with a ↗ arrow. Without one, it
renders as a plain `<div>` with no arrow — because that glyph promises "opens in
a new tab" and showing it on a dead card is a false affordance. Hover styling
applies either way.

Use ` · ` (U+00B7, spaced) as the stack separator to match the existing cards.

### The Recents carousel

- Sliding is **CSS scroll-snap**, not JavaScript — trackpad, touch swipe, and
  shift+wheel all work natively even if the script fails.
- Shows **3 cards** at a time, dropping to 2 below `48rem` and 1 below `34rem`.
- The arrow buttons and the 5s autoplay are ~50 lines of vanilla JS in
  `Rail.astro`, written as `<script is:inline>`.
- **Autoplay pauses** on pointer-over, keyboard focus (`focusin`), `touchstart`,
  hidden tab (`visibilitychange`), `prefers-reduced-motion: reduce`, and when the
  rail has too few cards to overflow. That pause set is what keeps it
  [WCAG 2.2.2](https://www.w3.org/WAI/WCAG21/Understanding/pause-stop-hide.html)
  compliant — auto-moving content lasting over 5s needs a stop mechanism.
- The rail needs **4+ cards** before it actually scrolls. There is a dashed
  placeholder card in `Rail.astro`; delete it once there is real work to show.

### Fonts

Self-hosted in `src/fonts/`, latin subset only, with the `@font-face` block at
the top of `global.css`. The descriptors were copied verbatim from the Google
Fonts `css2` response, so rendering is identical to the hosted version.

Archivo and IBM Plex Sans are **variable** fonts: both weights of each share a
single file and download once, so six `@font-face` rules resolve to four
requests. Paths are relative (`../fonts/…`) so Vite fingerprints them into
`_astro/` and Vercel serves them with immutable caching — do not move them to
`public/`, which would skip hashing.

To change a weight, request the new css2 URL with a browser user-agent (Google
serves woff2 only to modern UAs), take the `latin` blocks, and download the
files they reference.

### Changing the domain

`site` in [`astro.config.mjs`](astro.config.mjs) is the single source of truth.
Canonical, `og:url`, `og:image`, `twitter:image`, and every absolute URL in the
JSON-LD derive from it. Change it in one place, not eighteen.

### Regenerating the social card

`public/og.png` is a generated 1200x630 image using the site palette. If the
title or tagline changes, regenerate it — social platforms cache aggressively,
so re-scrape afterwards via the
[LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/) and the
[Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/).

---

## SEO

Handled in [`src/layouts/Base.astro`](src/layouts/Base.astro):

- `<title>` and meta description kept within SERP truncation limits (~60 and
  ~155 characters).
- Full Open Graph set including `og:image:width`/`height`, so LinkedIn and Slack
  can reserve layout before the image loads.
- `summary_large_image` Twitter card.
- **`Person` JSON-LD** with `sameAs` pointing at LinkedIn and GitHub. This is
  what lets Google merge those profiles into a single entity for the name — the
  highest-value structured data on a personal site.
- `@astrojs/sitemap` generates the sitemap at build time.

> **Submit `sitemap-index.xml` to Search Console, not `sitemap.xml`.**
> `@astrojs/sitemap` emits `sitemap-index.xml` (pointing at `sitemap-0.xml`).
> `public/robots.txt` already references the correct filename.

### What this site can realistically rank for

Worth being honest about, so effort goes to the right place:

- **Brand queries** ("art neroza") — yes, and the `Person` schema is what secures it.
- **Head terms** ("full stack developer") — no. That SERP is Wikipedia, AWS,
  W3Schools and course pages; the intent is definitional, not hiring.
- **Role + location** ("hubspot developer philippines") — dominated by Upwork,
  Toptal, Freelancer and other marketplace aggregators.
- **Specific technical problems** — the only real opening, and it requires blog
  content that marketplaces cannot generate.

---

## Conventions and gotchas

Things that will look wrong if you don't know why they're there.

### CSS is global, not component-scoped

All styles live in `src/styles/global.css` rather than in `<style>` blocks.
Astro's scoped styles do not cross component boundaries, so a selector like
`.rail > .card` written in `Rail.astro` would silently fail to match the `.card`
rendered by `Card.astro`. Global CSS avoids that entire class of bug.

### `body { grid-template-columns: minmax(0, 1fr) }` is load-bearing

Without it, the implicit grid column sizes to **max-content**, so the `100%` in
`--col: min(100% - 2.5rem, 46rem)` resolves against content width instead of the
viewport. `main` then sits at a fixed ~504px on every phone, and
`overflow-x: hidden` masks the overflow instead of revealing it. Do not remove it.

### The rail pads vertically only

`.rail` uses `padding: 4px 0; margin: -4px 0`. Horizontal padding would shrink
the `grid-auto-columns: 100%` basis and make rail cards 8px narrower than the
grid cards above them. Vertical padding still gives focus rings room.

### `inlineStylesheets: "always"`

The stylesheet is ~7 KB — below the point where a separate, render-blocking
request pays for itself. Inlining keeps the document to a **single request** (Vercel
Analytics adds one more at runtime).
Revisit this if a blog is added, where a shared cached stylesheet starts to win.

### `<script is:inline>` in `Rail.astro`

Without `is:inline`, Astro hoists the carousel script into a separate bundled
module — an extra request for ~2 KB. Inline is the right trade at this size.

### Reduced motion is handled explicitly

The global `prefers-reduced-motion` rule zeroes animation durations, which would
have frozen the availability dot's expanding ring mid-flight as a stray blob.
`.dot::after` is therefore hidden outright and replaced with a static glow, so
the indicator still reads as "available" without moving.

---

## Deployment

Vercel auto-detects Astro. Static output — **no adapter required**.

```
Framework Preset:  Astro
Build Command:     astro build
Output Directory:  dist
Install Command:   npm install
```

Push to `main` deploys production; every other branch gets a preview URL.

### Analytics

[Vercel Analytics](https://vercel.com/docs/analytics) is wired up via
`<Analytics />` in `Base.astro`. It only reports from a Vercel deployment —
locally it no-ops (and in dev it points at `va.vercel-scripts.com` for its debug
build). Enable Analytics for the project in the Vercel dashboard or nothing is
collected. In production the script is served first-party from
`/_vercel/insights/script.js`.

Note that the domain also sits behind Cloudflare, which injects **Cloudflare
Web Analytics** (`static.cloudflareinsights.com/beacon.min.js`, ~9.7 KB) — a
genuine third-party origin, and duplicate tracking alongside Vercel Analytics.
Either disable it in the Cloudflare dashboard or allowlist that origin in the
CSP below, or the script will be blocked.

**Domain:** add `artneroza.com` under Domains with the **apex as primary** and
`www` redirecting to it. If Vercel serves `www` as primary, it will contradict
the canonical tag, which points at the apex.

### Security headers

Not yet configured. The site has no forms and no user input, so the attack
surface is minimal — but headers are free. Add a `vercel.json`:

```json
{
  "headers": [{
    "source": "/(.*)",
    "headers": [
      { "key": "Content-Security-Policy", "value": "default-src 'none'; script-src 'self' 'unsafe-inline'; connect-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" },
      { "key": "X-Content-Type-Options", "value": "nosniff" },
      { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
      { "key": "Permissions-Policy", "value": "geolocation=(), microphone=(), camera=()" }
    ]
  }]
}
```

`'unsafe-inline'` is required in both `script-src` and `style-src` because the
carousel JS and the stylesheet are inlined by design. `connect-src 'self'` is
required for Vercel Analytics to POST its beacons to `/_vercel/insights/view` —
without it `default-src 'none'` blocks them. This policy also blocks Cloudflare
Web Analytics; if you keep that, add `https://static.cloudflareinsights.com` to
`script-src` and `connect-src`. Vercel provides HTTPS and HSTS automatically.

---

## Performance notes

The document is ~6 KB brotli with **zero framework runtime**; Vercel Analytics
accounts for roughly 1.2 KB of that plus one runtime request. The four font
files total ~110 KB, served first-party from `_astro/` with content hashes, so
they cache immutably after the first visit.

Fonts are now self-hosted, which removed that stylesheet along with two DNS
lookups and two TLS handshakes. Lighthouse reports **no render-blocking
resources**. Minifying the HTML is not worth
it — measured, it saves ~170 bytes after brotli and costs hand-editability.

---

## Known TODOs

- [ ] Years on the Recents cards are **placeholders**, not verified dates
      (flagged with a `TODO` in `src/data/projects.ts`).
- [ ] Replace or remove the dashed placeholder card in `Rail.astro`.
- [ ] Add `vercel.json` with the security headers above.
- [ ] Connect the Vercel project and point `artneroza.com` at it.
- [ ] `npm audit` reports vulnerabilities in the dev dependency tree —
      build-time only, nothing ships to visitors.

---

## Stack

[Astro 5](https://astro.build) · [@astrojs/sitemap](https://docs.astro.build/en/guides/integrations-guide/sitemap/) · [@vercel/analytics](https://vercel.com/docs/analytics) · vanilla CSS · vanilla JS · Vercel
