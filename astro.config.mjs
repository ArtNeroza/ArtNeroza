// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  // canonical, og:url and og:image all derive from this — declared once
  site: "https://artneroza.com",
  integrations: [sitemap()],

  build: {
    // the whole stylesheet is ~7 KB; one inlined request beats a
    // render-blocking round trip for a single-page site
    inlineStylesheets: "always",
  },
});
