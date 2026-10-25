"use client";

import { useEffect, useState } from "react";
import { usePlanContext } from "@/components/app-shell/plan-context";
import type { CoachStatus } from "@/lib/coach/provider";
import type { AskResponse, CoachError, CoachRequest, CoachSource, IdeasResponse } from "@/lib/coach/schema";
import { useAppStore } from "@/lib/state/store";

export interface ChatMessage {
  role: "student" | "coach";
  text: string;
  sources?: CoachSource[];
}

async function callCoach<T>(body: CoachRequest): Promise<T> {
  let res: Response;
  try {
    res = await fetch("/api/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw { error: "upstream", message: "Couldn't reach UniPath's server. Check your connection." } satisfies CoachError;
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw (json as CoachError | null) ?? ({ error: "upstream", message: "Something went wrong. Please try again." } satisfies CoachError);
  }
  return json as T;
}

/** Last ideas are remembered per browser so the free AI quota isn't spent on every visit. */
function cacheKey(profile: string, curriculumId: string) {
  return `unipath:coach:${profile}:${curriculumId}`;
}

interface Cached {
  fingerprint: string;
  ideas: IdeasResponse;
}

function readCache(key: string): Cached | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Cached) : null;
  } catch {
    return null;
  }
}

export function useCoach() {
  const plan = usePlanContext();
  const profile = useAppStore((s) => s.activeProfile);
  const key = cacheKey(profile, plan.curriculum.id);
  const completed = [...plan.completed].sort();
  const inProgress = [...plan.inProgress].sort();
  const fingerprint = JSON.stringify([completed, inProgress]);

  const [cached, setCached] = useState<Cached | null>(() => readCache(key));
  const [loading, setLoading] = useState<"ideas" | "ask" | null>(null);
  const [error, setError] = useState<CoachError | null>(null);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  /** Which AI provider the server has (null while loading or if the check failed). */
  const [status, setStatus] = useState<CoachStatus | null>(null);
  /** When the server asked us to wait (rate limits), the time it's OK to try again. */
  const [retryAt, setRetryAt] = useState<number | null>(null);
  const [clock, setClock] = useState(0);

  useEffect(() => {
    if (retryAt === null) return;
    const id = setInterval(() => {
      const t = Date.now();
      setClock(t);
      if (t >= retryAt) setRetryAt(null);
    }, 1000);
    return () => clearInterval(id);
  }, [retryAt]);

  const fail = (e: unknown) => {
    const err = e as CoachError;
    setError(err);
    if (err.retryAfterSeconds && err.retryAfterSeconds > 0) {
      const t = Date.now();
      setClock(t);
      setRetryAt(t + err.retryAfterSeconds * 1000);
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetch("/api/coach")
      .then((r) => (r.ok ? (r.json() as Promise<CoachStatus>) : null))
      .then((s) => {
        if (!cancelled) setStatus(s);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const base = { curriculumId: plan.curriculum.id, completed, inProgress };

  const getIdeas = async (interests: string) => {
    setLoading("ideas");
    setError(null);
    try {
      const ideas = await callCoach<IdeasResponse>({ ...base, mode: "ideas", interests: interests || undefined });
      const next = { fingerprint, ideas };
      setCached(next);
      setChat([]);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // Saving is a convenience only.
      }
    } catch (e) {
      fail(e);
    } finally {
      setLoading(null);
    }
  };

  /** Returns false if the question couldn't be answered (the error is shown instead). */
  const ask = async (question: string) => {
    const history = chat.slice(-6).map((m) => ({ role: m.role, text: m.text }));
    setChat((c) => [...c, { role: "student", text: question }]);
    setLoading("ask");
    setError(null);
    try {
      const answer = await callCoach<AskResponse>({
        ...base,
        mode: "ask",
        question,
        ideaTitles: cached?.ideas.ideas.map((i) => i.title),
        history,
      });
      setChat((c) => [...c, { role: "coach", text: answer.answer, sources: answer.sources }]);
      return true;
    } catch (e) {
      fail(e);
      setChat((c) => c.slice(0, -1));
      return false;
    } finally {
      setLoading(null);
    }
  };

  return {
    status,
    ideas: cached?.ideas ?? null,
    stale: !!cached && cached.fingerprint !== fingerprint,
    loading,
    error,
    /** Seconds until the coach can be asked again (0 when it can be asked now). */
    waitSeconds: retryAt === null ? 0 : Math.max(0, Math.ceil((retryAt - clock) / 1000)),
    chat,
    getIdeas,
    ask,
  };
}
