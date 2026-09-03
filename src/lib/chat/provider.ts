import { GoogleGenAI } from "@google/genai";
import { SYSTEM } from "./prompt";

export type Turn = { role: "user" | "assistant"; content: string };

/**
 * The only provider-specific file. Swapping vendors happens here and nowhere else.
 *
 * gemini-2.5-* is closed to new API keys (404 "no longer available to new users").
 * Free-tier request quota is PER MODEL PER DAY and small — gemini-3.6-flash is
 * only 20/day — so a lite model is used here. Pinned rather than using a
 * `-latest` alias so the model can't change under us without a commit.
 */
export const MODEL = "gemini-3.5-flash-lite";
// Gemini 3.x spends reasoning tokens from this same budget (~300-450 on a
// question like these), so 400 left only ~60 for the reply and cut it mid
// sentence. The visible length is capped by the system prompt, not by this.
export const MAX_ANSWER_TOKENS = 1200;

/**
 * Vercel injects real env vars into process.env at runtime; a local .env is
 * loaded by Vite into import.meta.env instead. Check runtime first so the
 * production value is never baked into the build.
 */
function apiKey(): string | undefined {
  return process.env.GEMINI_API_KEY ?? import.meta.env.GEMINI_API_KEY;
}

export function isConfigured() {
  return Boolean(apiKey());
}

/** Streams the answer back as plain UTF-8 text chunks. */
export async function askModel(history: Turn[], question: string): Promise<ReadableStream<Uint8Array>> {
  const ai = new GoogleGenAI({ apiKey: apiKey() });

  // Gemini calls the assistant role "model"
  const contents = [
    ...history.map((t) => ({
      role: t.role === "assistant" ? "model" : "user",
      parts: [{ text: t.content }],
    })),
    { role: "user", parts: [{ text: question }] },
  ];

  const call = () =>
    ai.models.generateContentStream({
      model: MODEL,
      contents,
      config: {
        systemInstruction: SYSTEM,
        maxOutputTokens: MAX_ANSWER_TOKENS,
        thinkingConfig: { thinkingLevel: "low" },
        temperature: 0.4,
      },
    });

  // Awaited here so auth/model failures throw BEFORE we commit to a 200
  // streaming response. Google returns a transient 503 ("overloaded") often
  // enough that one retry is worth it; 4xx is permanent, so don't retry those.
  let stream;
  try {
    stream = await call();
  } catch (err: any) {
    const code = err?.status ?? err?.code;
    if (code && code < 500 && code !== 429) throw err;
    await new Promise((r) => setTimeout(r, 700));
    try {
      stream = await call();
    } catch (retryErr: any) {
      const c = retryErr?.status ?? retryErr?.code;
      // still rate-limited / overloaded after a retry — tell the route it's
      // temporary, not broken
      if (c === 429 || c === 503) {
        retryErr.kafraBusy = true;
        // "PerDay" quota won't recover in a moment — it resets at midnight PT
        retryErr.kafraDaily = /PerDay/i.test(String(retryErr?.message ?? ""));
      }
      throw retryErr;
    }
  }

  return new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      let sent = false;
      let finish: string | undefined;
      try {
        for await (const chunk of stream) {
          finish = chunk.candidates?.[0]?.finishReason ?? finish;
          if (chunk.text) { controller.enqueue(enc.encode(chunk.text)); sent = true; }
        }
      } catch (err) {
        console.error("[kafra] mid-stream", err);
      }
      // A stream can finish with reasoning tokens but no text (safety filter, or
      // the budget spent thinking). Never leave the visitor with a blank bubble.
      if (!sent) {
        console.error("[kafra] empty answer, finishReason:", finish);
        controller.enqueue(enc.encode(
          "I don't have a good answer for that one — email art.neroza@gmail.com and Art can tell you directly."
        ));
      }
      controller.close();
    },
  });
}
