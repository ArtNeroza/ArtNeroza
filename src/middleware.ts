import type { MiddlewareHandler } from "astro";

/**
 * Refuses any request carrying an Astro path-override header.
 *
 * @astrojs/vercel 9.x routes on `x-astro-path` if a client sends it, which lets
 * anyone execute one route under another route's URL (GHSA: "Unauthenticated
 * Path Override"). Nothing on this site is hidden behind a path, but it defeats
 * anything keyed on one — edge rate limits, WAF rules, per-path caching, log
 * attribution — and it would let the chat route be reached under a URL that
 * doesn't look like the chat route.
 *
 * No legitimate client sends these, so refusing outright costs nothing. The
 * adapter upgrade that fixes it properly is a major version bump; this stands
 * in front of it either way.
 */
const OVERRIDE_HEADERS = ["x-astro-path", "x_astro_path"];

export const onRequest: MiddlewareHandler = (context, next) => {
  // Middleware also runs while prerendering, where there is no real request to
  // inspect — reading headers there only earns a build warning.
  if (context.isPrerendered) return next();

  for (const h of OVERRIDE_HEADERS) {
    if (context.request.headers.has(h)) {
      return new Response("Bad request.", {
        status: 400,
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
      });
    }
  }
  return next();
};
