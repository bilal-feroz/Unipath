import { describe, expect, it, vi } from "vitest";
import { getCurriculum } from "@/lib/curriculum/registry";
import { providerFromEnv } from "./config";
import { callGemini, geminiProvider } from "./gemini";
import { callGroq, groqProvider, stripCitationMarkers } from "./groq";
import { createCoachGuard, MAX_PARALLEL } from "./guard";
import { handleCoachRequest } from "./handler";
import { cleanAnswer, extractJson, normalizeIdeas, sourcesFrom } from "./parse";
import { askPrompt, cleanText, ideasPrompt, studentContext } from "./prompt";
import { retryAfterSeconds, type AiProvider } from "./provider";
import { createConcurrencyLimiter, createRateLimiter } from "./rate-limit";
import { coachRequestSchema } from "./schema";

const se = () => getCurriculum("aau-bsc-software-engineering")!;
const req = (overrides: Record<string, unknown> = {}) =>
  coachRequestSchema.parse({
    mode: "ideas",
    curriculumId: "aau-bsc-software-engineering",
    completed: ["0102120", "0102220", "0102221"],
    inProgress: ["0102270"],
    ...overrides,
  });

function geminiReply(text: string, extra: Record<string, unknown> = {}) {
  return new Response(
    JSON.stringify({
      candidates: [
        {
          content: { parts: [{ text }] },
          finishReason: "STOP",
          groundingMetadata: {
            webSearchQueries: ["software engineering graduate skills 2026"],
            groundingChunks: [
              { web: { uri: "https://example.org/report", title: "example.org" } },
              { web: { uri: "https://example.org/report", title: "duplicate" } },
              { web: { uri: "javascript:alert(1)", title: "bad" } },
            ],
          },
          ...extra,
        },
      ],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

const IDEAS_JSON = JSON.stringify({
  trends: "Employers expect testing, CI/CD and secure coding.",
  ideas: [
    {
      title: "Study group finder",
      summary: "A web app to match classmates.",
      whyItFits: "Uses OOP and data structures.",
      buildsOn: ["0102221 Object-Oriented Programming", "0102270", "9999999"],
      skills: ["TypeScript", "Testing"],
      industryPractices: ["Automated tests in CI"],
      stack: ["Next.js"],
      difficulty: "Intermediate",
      timeEstimate: "3 weeks",
      firstSteps: ["Sketch the screens", "Set up a repo"],
    },
    { summary: "No title, should be dropped" },
  ],
});

/** Each test gets its own limits so counts don't leak between tests. */
const withGuard = (provider: AiProvider | null) => ({ provider, guard: createCoachGuard() });

function post(body: unknown, ip = `test-${Math.random()}`) {
  return new Request("http://localhost/api/coach", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

describe("prompt building", () => {
  it("uses titles from the curriculum and ignores unknown or duplicate codes", () => {
    const ctx = studentContext(se(), req({ completed: ["0102120", "NOPE", "0102120"], inProgress: ["0102120", "0102220"] }));
    expect(ctx.completed).toEqual([{ code: "0102120", title: "Computer Skills" }]);
    expect(ctx.inProgress).toEqual([{ code: "0102220", title: "Introduction to Programming" }]);
    expect([...ctx.allowedCodes].sort()).toEqual(["0102120", "0102220"]);
  });

  it("describes the student and asks for JSON", () => {
    const ctx = studentContext(se(), req({ interests: "  web apps\n\nand games " }));
    const prompt = ideasPrompt(ctx);
    expect(prompt).toContain("Bachelor of Science in Software Engineering");
    expect(prompt).toContain("0102221 Object-Oriented Programming");
    expect(prompt).toContain("Taking this semester (1)");
    expect(prompt).toContain('Interests: "web apps and games"');
    expect(prompt).toContain('"buildsOn"');
    expect(askPrompt(ctx, "How do I start?", ["Idea A"])).toContain('The student asks: "How do I start?"');
  });

  it("cleans typed text", () => {
    expect(cleanText(" a\u0000b \n c ", 10)).toBe("a b c");
    expect(cleanText("   ", 10)).toBeNull();
    expect(cleanText("abcdef", 3)).toBe("abc");
  });
});

describe("parsing the AI's answer", () => {
  it("extracts JSON from fenced or chatty text", () => {
    expect(extractJson('Sure!\n```json\n{"a": 1}\n```')).toEqual({ a: 1 });
    expect(extractJson("no json here")).toBeNull();
    expect(extractJson("{broken")).toBeNull();
  });

  it("normalizes ideas and keeps only the student's own course codes", () => {
    const result = normalizeIdeas(JSON.parse(IDEAS_JSON), new Set(["0102221", "0102270"]))!;
    expect(result.ideas).toHaveLength(1);
    expect(result.ideas[0].buildsOn).toEqual(["0102221", "0102270"]);
    expect(result.ideas[0].difficulty).toBe("intermediate");
    expect(result.trends).toMatch(/CI\/CD/);
    expect(normalizeIdeas({ ideas: [] }, new Set())).toBeNull();
    expect(normalizeIdeas("text", new Set())).toBeNull();
  });

  it("keeps safe, unique web sources", () => {
    expect(
      sourcesFrom([
        { web: { uri: "https://a.org/x", title: "a.org" } },
        { web: { uri: "https://a.org/x", title: "again" } },
        { web: { uri: "ftp://b.org" } },
        { web: { uri: "https://c.org/y" } },
      ]),
    ).toEqual([
      { title: "a.org", url: "https://a.org/x" },
      { title: "c.org", url: "https://c.org/y" },
    ]);
  });

  it("strips headings and fences from answers", () => {
    expect(cleanAnswer("## Plan\n```\n- step one\n```")).toBe("Plan\n- step one");
  });
});

describe("rate limiting", () => {
  it("allows a burst, then asks the visitor to wait", () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 1000 });
    expect(limiter.check("a", 0).ok).toBe(true);
    expect(limiter.check("a", 10).ok).toBe(true);
    const third = limiter.check("a", 20);
    expect(third.ok).toBe(false);
    expect(third.retryAfterSeconds).toBe(1);
    expect(limiter.check("b", 20).ok).toBe(true);
    expect(limiter.check("a", 1001).ok).toBe(true);
  });

  it("applies every window and only counts allowed requests", () => {
    const limiter = createRateLimiter([
      { limit: 2, windowMs: 1000 },
      { limit: 3, windowMs: 10_000 },
    ]);
    expect(limiter.check("a", 0)).toMatchObject({ ok: true, remaining: 1 });
    expect(limiter.check("a", 1)).toMatchObject({ ok: true, remaining: 0 });
    expect(limiter.check("a", 2)).toMatchObject({ ok: false, retryAfterSeconds: 1 });
    expect(limiter.check("a", 1500).ok).toBe(true);
    // The short window has room again, but the long one is full until the first hit is 10 s old.
    expect(limiter.check("a", 2000)).toMatchObject({ ok: false, retryAfterSeconds: 8 });
    expect(limiter.peek("a", 10_001).ok).toBe(true);
  });

  it("limits parallel work per key", () => {
    const running = createConcurrencyLimiter(1);
    expect(running.canStart("a")).toBe(true);
    running.start("a");
    expect(running.canStart("a")).toBe(false);
    expect(running.canStart("b")).toBe(true);
    running.finish("a");
    expect(running.canStart("a")).toBe(true);
  });

  it("reads how long a provider asked us to wait", () => {
    expect(retryAfterSeconds("7")).toBe(7);
    expect(retryAfterSeconds("2.4")).toBe(3);
    expect(retryAfterSeconds(null, "Rate limit reached. Please try again in 1m30.5s.")).toBe(91);
    expect(retryAfterSeconds(null, undefined, "17s")).toBe(17);
    expect(retryAfterSeconds(null, "Please try again in 2h3m")).toBe(7380);
    expect(retryAfterSeconds(null, "no hint here")).toBeUndefined();
  });
});

describe("coach guard", () => {
  const provider = groqProvider({ apiKey: "k", fetchImpl: vi.fn() });

  it("lets one visitor run one request at a time", () => {
    const guard = createCoachGuard();
    const first = guard.admit({ visitor: "v", mode: "ask", provider, now: 0 });
    expect(first.ok).toBe(true);
    expect(guard.admit({ visitor: "v", mode: "ask", provider, now: 1 })).toMatchObject({ ok: false, error: "rate_limited" });
    expect(guard.admit({ visitor: "other", mode: "ask", provider, now: 1 }).ok).toBe(true);
    if (first.ok) first.done();
    expect(guard.admit({ visitor: "v", mode: "ask", provider, now: 2 }).ok).toBe(true);
  });

  it("limits ideas and questions separately", () => {
    const guard = createCoachGuard();
    const take = (mode: "ideas" | "ask", now: number) => {
      const r = guard.admit({ visitor: "v", mode, provider, now });
      if (r.ok) r.done();
      return r;
    };
    for (let i = 0; i < 4; i++) expect(take("ideas", i).ok).toBe(true);
    const fifth = take("ideas", 10);
    expect(fifth).toMatchObject({ ok: false, error: "rate_limited", status: 429 });
    expect(!fifth.ok && fifth.retryAfterSeconds).toBe(600);
    expect(take("ask", 11).ok).toBe(true);
  });

  it("caps parallel requests for the whole server", () => {
    const guard = createCoachGuard();
    for (let i = 0; i < MAX_PARALLEL; i++) expect(guard.admit({ visitor: `v${i}`, mode: "ask", provider, now: 0 }).ok).toBe(true);
    expect(guard.admit({ visitor: "late", mode: "ask", provider, now: 0 })).toMatchObject({ ok: false, error: "busy" });
  });

  it("stays under the provider's free-tier limit and pauses when the provider asks", () => {
    const guard = createCoachGuard();
    for (let i = 0; i < provider.limits.perMinute; i++) {
      const r = guard.admit({ visitor: `v${i}`, mode: "ask", provider, now: i });
      if (r.ok) r.done();
    }
    expect(guard.admit({ visitor: "new", mode: "ask", provider, now: 100 })).toMatchObject({ ok: false, error: "quota" });
    expect(guard.admit({ visitor: "new", mode: "ask", provider, now: 60_001 }).ok).toBe(true);

    const paused = createCoachGuard();
    paused.pause(30, 0);
    expect(paused.admit({ visitor: "v", mode: "ask", provider, now: 1000 })).toMatchObject({ ok: false, error: "quota", retryAfterSeconds: 29 });
    expect(paused.admit({ visitor: "v", mode: "ask", provider, now: 30_000 }).ok).toBe(true);
  });
});

describe("Gemini client", () => {
  it("sends Google Search grounding and the key in a header", async () => {
    const fetchImpl = vi.fn(async () => geminiReply("hello"));
    const out = await callGemini({ apiKey: "k", system: "sys", turns: [{ role: "user", text: "hi" }], fetchImpl });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/models/gemini-2.5-flash:generateContent");
    expect(url).not.toContain("k");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("k");
    const body = JSON.parse(init.body as string);
    expect(body.tools).toEqual([{ googleSearch: {} }]);
    expect(body.systemInstruction.parts[0].text).toBe("sys");
    expect(out).toMatchObject({ ok: true, text: "hello", sources: [{ url: "https://example.org/report" }] });
  });

  it("maps quota, bad keys, declines and timeouts to clear errors", async () => {
    const run = (res: Response | Error) =>
      callGemini({
        apiKey: "k",
        system: "s",
        turns: [{ role: "user", text: "q" }],
        fetchImpl: async () => {
          if (res instanceof Error) throw res;
          return res;
        },
      });
    expect(await run(new Response("{}", { status: 429 }))).toMatchObject({ ok: false, error: "quota", status: 429 });
    expect(
      await run(new Response(JSON.stringify({ error: { message: "API key not valid", status: "INVALID_ARGUMENT" } }), { status: 400 })),
    ).toMatchObject({ ok: false, error: "not_configured" });
    expect(await run(geminiReply("x", { finishReason: "SAFETY" }))).toMatchObject({ ok: false, error: "declined" });
    expect(await run(new Error("timeout"))).toMatchObject({ ok: false, error: "upstream", status: 504 });
    expect(await run(new Response("{}", { status: 500 }))).toMatchObject({ ok: false, error: "upstream", status: 503 });
  });
});

describe("POST /api/coach", () => {
  const body = {
    mode: "ideas",
    curriculumId: "aau-bsc-software-engineering",
    completed: ["0102120", "0102220", "0102221"],
    inProgress: ["0102270"],
  };

  it("explains when the AI isn't configured", async () => {
    const res = await handleCoachRequest(post(body), withGuard(null));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: "not_configured" });
  });

  it("rejects bad input before calling the AI", async () => {
    const fetchImpl = vi.fn();
    const bad = await handleCoachRequest(post({ ...body, curriculumId: "nope" }), withGuard(geminiProvider({ apiKey: "k", fetchImpl })));
    expect(bad.status).toBe(400);
    const tooMany = await handleCoachRequest(post({ ...body, completed: Array(200).fill("x") }), withGuard(geminiProvider({ apiKey: "k", fetchImpl })));
    expect(tooMany.status).toBe(400);
    const noQuestion = await handleCoachRequest(post({ ...body, mode: "ask" }), withGuard(geminiProvider({ apiKey: "k", fetchImpl })));
    expect(noQuestion.status).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns validated ideas with sources, and caches identical requests", async () => {
    const fetchImpl = vi.fn(async () => geminiReply(IDEAS_JSON));
    const uniqueBody = { ...body, interests: `cache-test-${Math.random()}` };
    const res = await handleCoachRequest(post(uniqueBody), withGuard(geminiProvider({ apiKey: "k", fetchImpl })));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.mode).toBe("ideas");
    expect(json.ideas[0].title).toBe("Study group finder");
    expect(json.ideas[0].buildsOn).toEqual(["0102221", "0102270"]);
    expect(json.sources).toEqual([{ title: "example.org", url: "https://example.org/report" }]);
    await handleCoachRequest(post(uniqueBody), withGuard(geminiProvider({ apiKey: "k", fetchImpl })));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("answers follow-up questions with the conversation so far", async () => {
    const fetchImpl = vi.fn(async () => geminiReply("Start with a small prototype."));
    const res = await handleCoachRequest(
      post({
        ...body,
        mode: "ask",
        question: "How do I start?",
        ideaTitles: ["Study group finder"],
        history: [
          { role: "coach", text: "dropped: conversations start with the student" },
          { role: "student", text: "Hi" },
          { role: "coach", text: "Hello!" },
        ],
      }),
      withGuard(geminiProvider({ apiKey: "k", fetchImpl })),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ mode: "ask", answer: "Start with a small prototype." });
    const sent = JSON.parse((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(sent.contents.map((c: { role: string }) => c.role)).toEqual(["user", "model", "user"]);
  });

  it("reports unreadable AI output", async () => {
    const fetchImpl = vi.fn(async () => geminiReply("Here are some ideas without JSON"));
    const res = await handleCoachRequest(post({ ...body, interests: `x-${Math.random()}` }), withGuard(geminiProvider({ apiKey: "k", fetchImpl })));
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ error: "bad_output" });
  });

  it("limits how often one visitor can ask, with Retry-After", async () => {
    const fetchImpl = vi.fn(async () => geminiReply("ok"));
    const env = withGuard(geminiProvider({ apiKey: "k", fetchImpl }));
    const statuses: number[] = [];
    let last: Response | undefined;
    for (let i = 0; i < 6; i++) {
      last = await handleCoachRequest(post({ ...body, mode: "ask", question: `q${i}` }, "same-visitor"), env);
      statuses.push(last.status);
    }
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
    expect(Number(last!.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(await last!.json()).toMatchObject({ error: "rate_limited", retryAfterSeconds: expect.any(Number) });
    expect(fetchImpl).toHaveBeenCalledTimes(5);
  });

  it("frees the visitor's slot even when the AI fails", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 500 }));
    const env = withGuard(geminiProvider({ apiKey: "k", fetchImpl }));
    const ask = () => handleCoachRequest(post({ ...body, mode: "ask", question: "q" }, "flaky"), env);
    expect((await ask()).status).toBe(503);
    expect((await ask()).status).toBe(503);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("pauses everyone when the provider says its quota is used up", async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ error: { message: "Rate limit reached" } }), { status: 429, headers: { "retry-after": "40" } }),
    );
    const env = withGuard(groqProvider({ apiKey: "k", fetchImpl }));
    const first = await handleCoachRequest(post({ ...body, mode: "ask", question: "q" }, "a"), env);
    expect(first.status).toBe(429);
    expect(first.headers.get("Retry-After")).toBe("40");
    const second = await handleCoachRequest(post({ ...body, mode: "ask", question: "q" }, "b"), env);
    expect(second.status).toBe(429);
    expect(await second.json()).toMatchObject({ error: "quota" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

function groqReply(content: string, executedTools: unknown[] = []) {
  return new Response(
    JSON.stringify({
      choices: [{ message: { role: "assistant", content, executed_tools: executedTools }, finish_reason: "stop" }],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

const SEARCH_TOOL = {
  type: "search",
  arguments: JSON.stringify({ query: "software engineering graduate skills" }),
  search_results: {
    results: [
      { title: "Example report", url: "https://example.org/report" },
      { title: "Duplicate", url: "https://example.org/report" },
      { title: "Bad", url: "javascript:alert(1)" },
    ],
  },
};

describe("Groq client", () => {
  it("calls the chat completions API with browser search and a bearer token", async () => {
    const fetchImpl = vi.fn(async () => groqReply("Use tests【2†L6-L10】 and CI.", [SEARCH_TOOL]));
    const out = await callGroq({
      apiKey: "gk",
      system: "sys",
      turns: [
        { role: "user", text: "hi" },
        { role: "model", text: "hello" },
        { role: "user", text: "ideas?" },
      ],
      search: "require",
      fetchImpl,
    });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer gk");
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("openai/gpt-oss-120b");
    expect(body.tools).toEqual([{ type: "browser_search" }]);
    expect(body.tool_choice).toBe("required");
    expect(body.reasoning_effort).toBe("low");
    expect(body.messages.map((m: { role: string }) => m.role)).toEqual(["system", "user", "assistant", "user"]);
    expect(out).toEqual({
      ok: true,
      text: "Use tests and CI.",
      sources: [{ title: "Example report", url: "https://example.org/report" }],
      searchQueries: ["software engineering graduate skills"],
      searched: true,
    });
  });

  it("lets follow-up questions search only when useful", async () => {
    const fetchImpl = vi.fn(async () => groqReply("Answer"));
    const out = await callGroq({ apiKey: "gk", system: "s", turns: [{ role: "user", text: "q" }], search: "allow", fetchImpl });
    const body = JSON.parse((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.tool_choice).toBe("auto");
    expect(out).toMatchObject({ ok: true, searched: false });
  });

  it("retries without search when the search request is too large for the free plan", async () => {
    const replies = [
      new Response(JSON.stringify({ error: { message: "Request too large for model: tokens per minute (TPM) limit 8000" } }), { status: 413 }),
      groqReply("Ideas without search"),
    ];
    const fetchImpl = vi.fn(async () => replies.shift()!);
    const out = await callGroq({ apiKey: "gk", system: "s", turns: [{ role: "user", text: "q" }], search: "require", fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const second = JSON.parse((fetchImpl.mock.calls[1] as unknown as [string, RequestInit])[1].body as string);
    expect(second.tools).toBeUndefined();
    expect(out).toMatchObject({ ok: true, text: "Ideas without search", searched: false });
  });

  it("maps bad keys and quota errors", async () => {
    const run = (res: Response) =>
      callGroq({ apiKey: "gk", system: "s", turns: [{ role: "user", text: "q" }], search: "allow", fetchImpl: async () => res });
    expect(await run(new Response(JSON.stringify({ error: { code: "invalid_api_key" } }), { status: 401 }))).toMatchObject({
      ok: false,
      error: "not_configured",
    });
    expect(await run(new Response(JSON.stringify({ error: { message: "requests per day" } }), { status: 429 }))).toMatchObject({
      ok: false,
      error: "quota",
      retryAfterSeconds: 30,
    });
    expect(
      await run(new Response(JSON.stringify({ error: { message: "tokens per day (TPD): Please try again in 3h2m" } }), { status: 429 })),
    ).toMatchObject({ ok: false, error: "quota", retryAfterSeconds: 10920, message: expect.stringMatching(/tomorrow/) });
    expect(await run(groqReply(""))).toMatchObject({ ok: false, error: "bad_output" });
  });

  it("removes inline citation markers", () => {
    expect(stripCitationMarkers("Fact【1†L2-L3】 here【4】.")).toBe("Fact here.");
  });
});

describe("choosing the AI provider", () => {
  it("prefers Groq, can be forced, and is off without keys", () => {
    expect(providerFromEnv({})).toBeNull();
    expect(providerFromEnv({ GEMINI_API_KEY: "g" })?.id).toBe("gemini");
    expect(providerFromEnv({ GEMINI_API_KEY: "g", GROQ_API_KEY: "q" })?.id).toBe("groq");
    expect(providerFromEnv({ GEMINI_API_KEY: "g", GROQ_API_KEY: "q", AI_PROVIDER: "gemini" })?.id).toBe("gemini");
    expect(providerFromEnv({ GROQ_API_KEY: "q", GROQ_MODEL: "openai/gpt-oss-20b" })?.model).toBe("openai/gpt-oss-20b");
    expect(providerFromEnv({ GROQ_API_KEY: "  " })).toBeNull();
    // A Groq key saved under another variable name is still found, and only real-looking keys count.
    expect(providerFromEnv({ Unipath: "gsk_abcdefghijklmnopqrstuvwxyz123456" })?.id).toBe("groq");
    expect(providerFromEnv({ NOTE: "gsk_short", OTHER: "hello" })).toBeNull();
  });

  it("returns Groq ideas through the full handler", async () => {
    const fetchImpl = vi.fn(async () => groqReply(IDEAS_JSON, [SEARCH_TOOL]));
    const provider = providerFromEnv({ GROQ_API_KEY: "q" }, fetchImpl);
    const res = await handleCoachRequest(
      post({ mode: "ideas", curriculumId: "aau-bsc-software-engineering", completed: ["0102221"], interests: `groq-${Math.random()}` }),
      withGuard(provider),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      provider: "Groq",
      model: "openai/gpt-oss-120b",
      searched: true,
      ideas: [{ title: "Study group finder", buildsOn: ["0102221"] }],
    });
  });
});