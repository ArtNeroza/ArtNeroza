/**
 * Authenticates the assistant turns a client sends back as conversation history.
 *
 * The route replays that history to the model as prior turns. Taken on trust,
 * a visitor can forge what "Kafra" already said — the model then sees itself
 * having agreed to something, which is the easiest way to talk it out of its
 * system prompt. Signing each answer on the way out and verifying it on the way
 * back means only text this server actually produced can be replayed as its own.
 *
 * The signature travels as a trailer on the answer stream (a record-separator
 * byte, then the tag), because the text isn't known when the headers go out.
 */
import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import { CHAT_SECRET, GEMINI_API_KEY } from "astro:env/server";

/** RS. Never appears in model prose, so it can't be spoofed into the answer. */
export const TRAILER = "\u001e";

/**
 * A dedicated secret is preferred. Falling back to a hash of the API key keeps
 * signing working out of the box: it is server-only, stable across instances
 * and cold starts, and the key itself is not derivable from the digest.
 */
function secret(): string | undefined {
  if (CHAT_SECRET) return CHAT_SECRET;
  return GEMINI_API_KEY
    ? createHash("sha256").update(`kafra:${GEMINI_API_KEY}`).digest("hex")
    : undefined;
}

export function sign(text: string): string {
  const s = secret();
  if (!s) return "";
  return createHmac("sha256", s).update(text).digest("base64url");
}

export function verify(text: string, tag: unknown): boolean {
  if (typeof tag !== "string" || !tag) return false;
  const expected = sign(text);
  if (!expected) return false;

  const a = Buffer.from(expected);
  const b = Buffer.from(tag);
  return a.length === b.length && timingSafeEqual(a, b);
}
