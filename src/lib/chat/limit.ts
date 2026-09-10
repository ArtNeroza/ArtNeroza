/**
 * Rate limiting for the one route that costs money.
 *
 * The previous limiter lived in a module-scope Map. Serverless instances are
 * not shared and are recycled constantly, so those counters reset on every cold
 * start and never span concurrent instances — the daily budget was effectively
 * unenforced, and roughly twenty scripted requests could exhaust the model
 * quota for every real visitor.
 *
 * Configure KV_REST_API_URL + KV_REST_API_TOKEN (Vercel KV or Upstash Redis,
 * both use these names) and the counters become durable and shared. Without
 * them this falls back to the old per-instance behaviour, says so on boot, and
 * still enforces the caps as well as one instance can.
 *
 * Counters are reserved BEFORE the model call and refunded if it fails, so a
 * burst of concurrent requests cannot slip past the cap between check and
 * increment.
 */

const URL_ = process.env.KV_REST_API_URL;
const TOKEN = process.env.KV_REST_API_TOKEN;

export const DURABLE = Boolean(URL_ && TOKEN);

export const PER_IP_PER_DAY = 6;      // must stay >= the client's 5, or the UI
                                      // would promise questions we then refuse
export const DAILY_MODEL_BUDGET = 20; // gemini free tier: requests/day/model

const TTL = 172_800;                  // 2 days — long enough to cover any timezone

function day() { return Math.floor(Date.now() / 86_400_000); }

/** Never store a visitor's raw address — a truncated hash is enough to count. */
async function tag(ip: string) {
  const bytes = new TextEncoder().encode(`kafra:${ip}`);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash).slice(0, 8))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/* ---- durable backend ------------------------------------------------ */

async function redis(commands: (string | number)[][]): Promise<any[]> {
  const res = await fetch(`${URL_}/pipeline`, {
    method: "POST",
    headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify(commands),
    signal: AbortSignal.timeout(2000),
  });
  if (!res.ok) throw new Error(`kv ${res.status}`);
  return res.json();
}

/** INCR then set the TTL only if the key is new, so the window can't slide. */
async function bump(keys: string[], by: number): Promise<number[]> {
  const cmds = keys.flatMap((k) =>
    by > 0 ? [["INCR", k], ["EXPIRE", k, TTL, "NX"]] : [["DECR", k]]
  );
  const out = await redis(cmds);
  const step = by > 0 ? 2 : 1;
  return keys.map((_, i) => Number(out[i * step]?.result ?? 0));
}

/* ---- in-memory fallback --------------------------------------------- */

const local = new Map<string, { n: number; day: number }>();

function bumpLocal(keys: string[], by: number): number[] {
  return keys.map((k) => {
    const rec = local.get(k);
    if (!rec || rec.day !== day()) {
      const next = { n: Math.max(0, by), day: day() };
      local.set(k, next);
      return next.n;
    }
    rec.n = Math.max(0, rec.n + by);
    return rec.n;
  });
}

/* ---- public API ------------------------------------------------------ */

export type Verdict =
  | { ok: true; modelLeft: number }
  | { ok: false; reason: "visitor" | "daily"; modelLeft: number };

function keys(who: string) {
  return [`kafra:ip:${day()}:${who}`, `kafra:model:${day()}`];
}

/**
 * Claims one visitor question and one model call, or refuses. Both counters
 * move together so neither can be overrun by concurrent requests; a refusal
 * gives back whatever it took.
 */
export async function reserve(ip: string): Promise<Verdict> {
  const k = keys(await tag(ip));
  let ipCount: number, modelCount: number;

  try {
    [ipCount, modelCount] = DURABLE ? await bump(k, 1) : bumpLocal(k, 1);
  } catch (err) {
    // the store being down must not take Kafra down with it
    console.error("[kafra] limiter unavailable, falling back to memory", err);
    [ipCount, modelCount] = bumpLocal(k, 1);
  }

  const modelLeft = Math.max(0, DAILY_MODEL_BUDGET - modelCount);

  if (modelCount > DAILY_MODEL_BUDGET) {
    await refund(ip);
    return { ok: false, reason: "daily", modelLeft: 0 };
  }
  if (ipCount > PER_IP_PER_DAY) {
    await refund(ip);
    return { ok: false, reason: "visitor", modelLeft };
  }
  return { ok: true, modelLeft };
}

/** Hands back a reservation the model never actually spent. */
export async function refund(ip: string): Promise<void> {
  const k = keys(await tag(ip));
  try {
    if (DURABLE) await bump(k, -1);
    else bumpLocal(k, -1);
  } catch (err) {
    console.error("[kafra] refund failed", err);
  }
}
