import { describe, expect, it, vi } from "vitest";
import { getCurriculum } from "@/lib/curriculum/registry";
import { callGemini } from "./gemini";
import { handleCoachRequest } from "./handler";
import { cleanAnswer, extractJson, normalizeIdeas, sourcesFrom } from "./parse";
import { askPrompt, cleanText, ideasPrompt, studentContext } from "./prompt";
import { createRateLimiter } from "./rate-limit";
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
    const res = await handleCoachRequest(post(body), { apiKey: undefined });
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: "not_configured" });
  });

  it("rejects bad input before calling the AI", async () => {
    const fetchImpl = vi.fn();
    const bad = await handleCoachRequest(post({ ...body, curriculumId: "nope" }), { apiKey: "k", fetchImpl });
    expect(bad.status).toBe(400);
    const tooMany = await handleCoachRequest(post({ ...body, completed: Array(200).fill("x") }), { apiKey: "k", fetchImpl });
    expect(tooMany.status).toBe(400);
    const noQuestion = await handleCoachRequest(post({ ...body, mode: "ask" }), { apiKey: "k", fetchImpl });
    expect(noQuestion.status).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns validated ideas with sources, and caches identical requests", async () => {
    const fetchImpl = vi.fn(async () => geminiReply(IDEAS_JSON));
    const uniqueBody = { ...body, interests: `cache-test-${Math.random()}` };
    const res = await handleCoachRequest(post(uniqueBody), { apiKey: "k", fetchImpl });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.mode).toBe("ideas");
    expect(json.ideas[0].title).toBe("Study group finder");
    expect(json.ideas[0].buildsOn).toEqual(["0102221", "0102270"]);
    expect(json.sources).toEqual([{ title: "example.org", url: "https://example.org/report" }]);
    await handleCoachRequest(post(uniqueBody), { apiKey: "k", fetchImpl });
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
      { apiKey: "k", fetchImpl },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ mode: "ask", answer: "Start with a small prototype." });
    const sent = JSON.parse((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(sent.contents.map((c: { role: string }) => c.role)).toEqual(["user", "model", "user"]);
  });

  it("reports unreadable AI output", async () => {
    const fetchImpl = vi.fn(async () => geminiReply("Here are some ideas without JSON"));
    const res = await handleCoachRequest(post({ ...body, interests: `x-${Math.random()}` }), { apiKey: "k", fetchImpl });
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ error: "bad_output" });
  });

  it("limits how often one visitor can ask", async () => {
    const fetchImpl = vi.fn(async () => geminiReply("ok"));
    const ip = "rate-limit-test";
    const statuses: number[] = [];
    for (let i = 0; i < 9; i++) {
      const res = await handleCoachRequest(post({ ...body, mode: "ask", question: `q${i}` }, ip), { apiKey: "k", fetchImpl });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 8).every((s) => s === 200)).toBe(true);
    expect(statuses[8]).toBe(429);
  });
});
