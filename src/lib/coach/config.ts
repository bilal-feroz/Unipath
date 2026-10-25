import { geminiProvider } from "./gemini";
import { groqProvider } from "./groq";
import type { AiProvider } from "./provider";

type Env = Record<string, string | undefined>;

/**
 * A Groq key saved under another name (dashboards make it easy to type a label as the variable name).
 * Groq keys always start with "gsk_", so the value itself says what it is.
 */
function groqKeyUnderAnotherName(env: Env): string | undefined {
  for (const value of Object.values(env)) {
    const v = value?.trim();
    if (v && /^gsk_[A-Za-z0-9]{20,}$/.test(v)) return v;
  }
  return undefined;
}

/**
 * Picks the AI provider from environment variables. Groq is used when GROQ_API_KEY is set (or a Groq
 * key is found under another variable name), otherwise Gemini when GEMINI_API_KEY is set.
 * AI_PROVIDER ("groq" or "gemini") forces one of them.
 */
export function providerFromEnv(env: Env, fetchImpl?: typeof fetch): AiProvider | null {
  const forced = env.AI_PROVIDER?.trim().toLowerCase();
  const groq = env.GROQ_API_KEY?.trim() || groqKeyUnderAnotherName(env);
  const gemini = env.GEMINI_API_KEY?.trim();
  if (groq && (!forced || forced === "groq")) {
    return groqProvider({ apiKey: groq, model: env.GROQ_MODEL?.trim(), fetchImpl });
  }
  if (gemini && (!forced || forced === "gemini")) {
    return geminiProvider({ apiKey: gemini, model: env.GEMINI_MODEL?.trim(), fetchImpl });
  }
  return null;
}
