import { handleCoachRequest } from "@/lib/coach/handler";

// Grounded answers can take a while; give the function time to finish.
export const maxDuration = 60;

export async function POST(request: Request) {
  return handleCoachRequest(request, {
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL,
  });
}
