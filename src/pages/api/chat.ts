import type { APIRoute } from "astro";
import { askModel, isConfigured, type Turn } from "../../lib/chat/provider";

// the only non-prerendered route — everything else stays static
export const prerender = false;

const MAX_QUESTION = 300;   // characters
const MAX_HISTORY = 2;      // prior turns kept
const PER_IP_PER_DAY = 6;      // must stay >= the client's 5, or the UI would
                               // promise questions the server refuses
const DAILY_MODEL_BUDGET = 20; // gemini free tier: requests/day/model

// Warm-instance guard. Serverless instances are not shared, so this is a speed
// bump, not a wall — Phase 3 replaces it with a durable store.
const hits = new Map<string, { n: number; day: number }>();
let modelCalls = { n: 0, day: -1 };

function modelLeft() {
  if (modelCalls.day !== day()) return DAILY_MODEL_BUDGET;
  return Math.max(0, DAILY_MODEL_BUDGET - modelCalls.n);
}
function countModelCall() {
  if (modelCalls.day !== day()) modelCalls = { n: 1, day: day() };
  else modelCalls.n += 1;
}

function day() { return Math.floor(Date.now() / 86_400_000); }

/** read-only check */
function overLimit(ip: string) {
  const rec = hits.get(ip);
  return Boolean(rec && rec.day === day() && rec.n >= PER_IP_PER_DAY);
}

/** called only after the model actually answered */
function spend(ip: string) {
  const rec = hits.get(ip);
  if (!rec || rec.day !== day()) hits.set(ip, { n: 1, day: day() });
  else rec.n += 1;
}

const text = (body: string, status: number) =>
  new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

export const POST: APIRoute = async ({ request, clientAddress }) => {
  if (!isConfigured()) {
    return text("Kafra is offline right now — please email art.neroza@gmail.com.", 503);
  }
  let body: { question?: unknown; history?: unknown };
  try {
    body = await request.json();
  } catch {
    return text("Bad request.", 400);
  }

  const DEV = import.meta.env.DEV;

  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question) return text("Ask me something about Art.", 400);
  if (question.length > MAX_QUESTION) {
    return text(`Please keep it under ${MAX_QUESTION} characters.`, 400);
  }

  const history: Turn[] = Array.isArray(body.history)
    ? (body.history as Turn[])
        .filter((t) => t && (t.role === "user" || t.role === "assistant") && typeof t.content === "string")
        .slice(-MAX_HISTORY * 2)
        .map((t) => ({ role: t.role, content: String(t.content).slice(0, 1000) }))
    : [];

  // Only a request that will actually reach the model spends quota — a
  // malformed or oversized one costs nothing, so it must not count.
  if (!DEV && overLimit(clientAddress ?? "unknown")) {
    return text("That's all my questions for today — please email art.neroza@gmail.com.", 429);
  }

  let stream: ReadableStream<Uint8Array>;
  try {
    stream = await askModel(history, question);
  } catch (err: any) {
    // never consumes the visitor's allowance either way
    console.error("[kafra]", err);
    if (err?.kafraDaily) {
      return text("That's all for today, please email art.neroza@gmail.com for more information", 503);
    }
    if (err?.kafraBusy) {
      return text("Coffee break! Too many at once - grab a coffee and try again", 503);
    }
    return text("Kafra is offline right now — please email art.neroza@gmail.com.", 502);
  }

  if (!DEV) spend(clientAddress ?? "unknown");
  countModelCall();

  return new Response(stream, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      // approximate: this counter lives in one warm instance, so it under-reports
      // if Vercel spins up another. Good enough to show a trend.
      "x-kafra-quota-left": String(modelLeft()),
      "x-kafra-quota-total": String(DAILY_MODEL_BUDGET),
    },
  });
};
