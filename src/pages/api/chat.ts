import type { APIRoute } from "astro";
import { askModel, isConfigured, type Turn } from "../../lib/chat/provider";
import { reserve, refund, DURABLE, DAILY_MODEL_BUDGET } from "../../lib/chat/limit";
import { sign, verify, TRAILER } from "../../lib/chat/sign";

// the only non-prerendered route — everything else stays static
export const prerender = false;

const MAX_QUESTION = 300;   // characters
const MAX_HISTORY = 2;      // prior turns kept

const text = (body: string, status: number) =>
  new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

/**
 * Every browser sends Origin on a POST, including a same-origin one, so
 * requiring it costs real visitors nothing while turning away the casual
 * scripted abuse this route is worth protecting from. Compared against the
 * request's own Host so custom domains and preview deployments both pass.
 *
 * This is a speed bump, not authentication — Origin is trivially set by a
 * determined client. The durable counters in limit.ts are the real cap.
 */
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const host = request.headers.get("host");
    return Boolean(host) && new URL(origin).host === host;
  } catch {
    return false;
  }
}

/**
 * Keeps only turns this server can vouch for. A visitor's own questions are
 * theirs to write, but an assistant turn is replayed to the model as something
 * "Kafra" already said, so it is accepted only with a signature this server
 * produced. Unsigned or altered answers are dropped rather than rejected, so a
 * stale tab degrades to a shorter memory instead of an error.
 */
function trustedHistory(raw: unknown): Turn[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t: any) => t && typeof t.content === "string")
    .filter((t: any) => {
      if (t.role === "user") return true;
      if (t.role !== "assistant") return false;
      return verify(t.content, t.sig);
    })
    .slice(-MAX_HISTORY * 2)
    .map((t: any) => ({ role: t.role, content: String(t.content).slice(0, 1000) }));
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  // Not import.meta.env.DEV: touching import.meta.env in a server chunk pulls a
  // snapshot of the whole build environment into the bundle.
  const DEV = process.env.NODE_ENV !== "production";

  if (!isConfigured()) {
    return text("Kafra is offline right now — please email art.neroza@gmail.com.", 503);
  }
  if (!DEV && !sameOrigin(request)) {
    return text("Bad request.", 403);
  }

  let body: { question?: unknown; history?: unknown };
  try {
    body = await request.json();
  } catch {
    return text("Bad request.", 400);
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question) return text("Ask me something about Art.", 400);
  if (question.length > MAX_QUESTION) {
    return text(`Please keep it under ${MAX_QUESTION} characters.`, 400);
  }

  const history = trustedHistory(body.history);

  // Claimed before the model is called, so a burst of concurrent requests can't
  // slip past the cap in the gap between checking and counting. Anything that
  // fails after this point gives the reservation back.
  const ip = clientAddress ?? "unknown";
  const claim = DEV ? { ok: true as const, modelLeft: DAILY_MODEL_BUDGET } : await reserve(ip);

  if (!claim.ok) {
    if (claim.reason === "daily") {
      return text("That's all for today, please email art.neroza@gmail.com for more information", 503);
    }
    return text("That's all my questions for today — please email art.neroza@gmail.com.", 429);
  }

  let stream: ReadableStream<Uint8Array>;
  try {
    stream = await askModel(history, question);
  } catch (err: any) {
    if (!DEV) await refund(ip);
    console.error("[kafra]", err);
    if (err?.kafraDaily) {
      return text("That's all for today, please email art.neroza@gmail.com for more information", 503);
    }
    if (err?.kafraBusy) {
      return text("Coffee break! Too many at once - grab a coffee and try again", 503);
    }
    return text("Kafra is offline right now — please email art.neroza@gmail.com.", 502);
  }

  // Sign the answer on its way out so the client can hand it back as history
  // and have it believed. The tag can only be appended once the text is known,
  // which is after the headers have gone — hence a trailer on the body.
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  let answer = "";

  const signed = stream.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        answer += dec.decode(chunk, { stream: true });
        controller.enqueue(chunk);
      },
      flush(controller) {
        controller.enqueue(enc.encode(TRAILER + sign(answer)));
      },
    })
  );

  return new Response(signed, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-kafra-quota-left": String(claim.modelLeft),
      "x-kafra-quota-total": String(DAILY_MODEL_BUDGET),
      // durable counters are shared and exact; the in-memory fallback is not
      "x-kafra-quota-exact": DURABLE ? "1" : "0",
    },
  });
};
