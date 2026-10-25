import { providerFromEnv } from "@/lib/coach/config";
import { handleExtractRequest } from "@/lib/schedule/extract-handler";

// Reading a long document can take a while.
export const maxDuration = 60;

export async function POST(request: Request) {
  return handleExtractRequest(request, { provider: providerFromEnv(process.env) });
}
