import type { APIRoute } from "astro";

// live reading, so it can't be baked in at build time
export const prerender = false;

// San Fernando, La Union
const LAT = 16.6159;
const LON = 120.3209;

const UPSTREAM =
  `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
  `&current=weather_code,is_day&timezone=Asia%2FManila`;

const FRESH_MS = 15 * 60 * 1000;   // how long one upstream reading is reused
const FRESH = FRESH_MS / 1000;     // and the same window for the CDN
const STALE = 3600;                // how long the CDN may serve it while refetching

type Reading = { code: number; day: boolean };

/**
 * Warm-instance memo. The CDN keys on the full URL including the query string,
 * so `/api/weather?anything` misses the edge cache and reaches the function —
 * without this, a loop of unique query strings would turn into unbounded
 * outbound traffic to Open-Meteo from this deployment's egress IP. The memo
 * caps that at one upstream call per instance per FRESH_MS no matter how the
 * request arrives.
 */
let memo: { at: number; body: Reading } | null = null;
let inflight: Promise<Reading> | null = null;

function json(body: unknown, status: number, cache: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": cache },
  });
}

async function fetchReading(): Promise<Reading> {
  const res = await fetch(UPSTREAM, { signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error(`open-meteo ${res.status}`);

  const data = await res.json();
  const code = Number(data?.current?.weather_code);
  if (!Number.isFinite(code)) throw new Error("no weather_code in response");

  return { code, day: data.current.is_day === 1 };
}

export const GET: APIRoute = async () => {
  const fresh = memo && Date.now() - memo.at < FRESH_MS;
  if (fresh) return json(memo!.body, 200, `public, s-maxage=${FRESH}, stale-while-revalidate=${STALE}`);

  try {
    // one upstream call even if several requests land on this instance at once
    inflight ??= fetchReading().finally(() => { inflight = null; });
    const body = await inflight;
    memo = { at: Date.now(), body };
    return json(body, 200, `public, s-maxage=${FRESH}, stale-while-revalidate=${STALE}`);
  } catch (err) {
    console.error("[weather]", err);
    // a stale reading beats no icon at all
    if (memo) return json(memo.body, 200, `public, s-maxage=60, stale-while-revalidate=${STALE}`);
    // the client keeps its clock and just shows no icon
    return json({}, 503, "no-store");
  }
};
