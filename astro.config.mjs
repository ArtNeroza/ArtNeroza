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

  build: {
    // the whole stylesheet is ~7 KB; one inlined request beats a
    // render-blocking round trip for a single-page site
    inlineStylesheets: "always",
  },
});
