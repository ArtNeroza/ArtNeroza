import type { APIRoute } from "astro";

// live reading, so it can't be baked in at build time
export const prerender = false;

// San Fernando, La Union
const LAT = 16.6159;
const LON = 120.3209;

const UPSTREAM =
  `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
  `&current=weather_code,is_day&timezone=Asia%2FManila`;

const FRESH = 900;    // seconds the CDN serves a reading before refetching
const STALE = 3600;   // and how long it may keep serving it while it refetches

export const GET: APIRoute = async () => {
  try {
    const res = await fetch(UPSTREAM, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(`open-meteo ${res.status}`);

    const data = await res.json();
    const code = Number(data?.current?.weather_code);
    if (!Number.isFinite(code)) throw new Error("no weather_code in response");

    return new Response(JSON.stringify({ code, day: data.current.is_day === 1 }), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        // one upstream call per 15 min for the whole site, not one per visitor
        "cache-control": `public, s-maxage=${FRESH}, stale-while-revalidate=${STALE}`,
      },
    });
  } catch (err) {
    console.error("[weather]", err);
    // the client keeps its clock and just shows no icon
    return new Response("{}", {
      status: 503,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  }
};
