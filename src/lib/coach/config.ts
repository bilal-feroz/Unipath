import { geminiProvider } from "./gemini";
import { groqProvider } from "./groq";
import type { AiProvider } from "./provider";

type Env = Record<string, string | undefined>;

/**
 * Picks the AI provider from environment variables. Groq is used when GROQ_API_KEY is set, otherwise
 * Gemini when GEMINI_API_KEY is set. AI_PROVIDER ("groq" or "gemini") forces one of them.
 */
export function providerFromEnv(env: Env, fetchImpl?: typeof fetch): AiProvider | null {
  const forced = env.AI_PROVIDER?.trim().toLowerCase();
  const groq = env.GROQ_API_KEY?.trim();
  const gemini = env.GEMINI_API_KEY?.trim();
  if (groq && (!forced || forced === "groq")) {
    return groqProvider({ apiKey: groq, model: env.GROQ_MODEL?.trim(), fetchImpl });
  }
  if (gemini && (!forced || forced === "gemini")) {
    return geminiProvider({ apiKey: gemini, model: env.GEMINI_MODEL?.trim(), fetchImpl });
  }
  return null;
}
