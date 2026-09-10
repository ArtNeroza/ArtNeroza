// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import vercel from "@astrojs/vercel";

export default defineConfig({
  // canonical, og:url and og:image all derive from this — declared once
  site: "https://artneroza.com",
  integrations: [sitemap()],

  // Static by default; only routes with `export const prerender = false`
  // (currently just /api/chat) become serverless functions.
  adapter: vercel(),

  // Emits a per-page CSP with a sha256 for every inline script, so the
  // effective script-src is a hash allowlist. The header in vercel.json still
  // carries 'unsafe-inline' because these hashes change every build and can't
  // be hardcoded there — but two policies both have to allow a script, so the
  // intersection is hashes only. The header is what carries frame-ancestors,
  // which a meta policy is not allowed to set.
  experimental: {
    csp: {
      directives: ["default-src 'none'", "img-src 'self' data:", "font-src 'self'", "connect-src 'self'", "base-uri 'none'", "form-action 'none'"],
      styleDirective: { resources: ["'self'", "'unsafe-inline'"] },
    },
  },

  build: {
    // the whole stylesheet is ~7 KB; one inlined request beats a
    // render-blocking round trip for a single-page site
    inlineStylesheets: "always",
  },
});
