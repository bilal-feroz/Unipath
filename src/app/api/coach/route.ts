import { connection } from "next/server";
import { providerFromEnv } from "@/lib/coach/config";
import { handleCoachRequest } from "@/lib/coach/handler";
import { statusOf } from "@/lib/coach/provider";

// Grounded answers can take a while; give the function time to finish.
export const maxDuration = 60;

/** Which AI provider is configured (never the key), so the page can name it and its privacy terms. */
export async function GET() {
  await connection();
  return Response.json(statusOf(providerFromEnv(process.env)));
}

export async function POST(request: Request) {
  return handleCoachRequest(request, { provider: providerFromEnv(process.env) });
}
