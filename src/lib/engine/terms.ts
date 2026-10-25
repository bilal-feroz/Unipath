export type Season = "spring" | "summer" | "fall";

export interface Term {
  season: Season;
  year: number;
}

const SEASON_LABEL: Record<Season, string> = { spring: "Spring", summer: "Summer", fall: "Fall" };

export function termLabel(term: Term): string {
  return `${SEASON_LABEL[term.season]} ${term.year}`;
}

export function termKey(term: Term): string {
  return `${term.season}-${term.year}`;
}

export function parseTermKey(key: string): Term | null {
  const m = /^(spring|summer|fall)-(\d{4})$/.exec(key);
  return m ? { season: m[1] as Season, year: Number(m[2]) } : null;
}

/** The term after `term`. Summer terms are skipped unless included. */
export function nextTerm(term: Term, includeSummer: boolean): Term {
  switch (term.season) {
    case "spring":
      return includeSummer ? { season: "summer", year: term.year } : { season: "fall", year: term.year };
    case "summer":
      return { season: "fall", year: term.year };
    case "fall":
      return { season: "spring", year: term.year + 1 };
  }
}

/**
 * The next regular (fall or spring) semester after today.
 * Aug–Dec → next spring; Jan–Jul → this year's fall.
 */
export function defaultStartTerm(now: Date = new Date()): Term {
  const month = now.getMonth();
  return month >= 7 ? { season: "spring", year: now.getFullYear() + 1 } : { season: "fall", year: now.getFullYear() };
}

export function termSequence(start: Term, includeSummer: boolean, count: number): Term[] {
  const terms: Term[] = [];
  let t = start;
  for (let i = 0; i < count; i++) {
    terms.push(t);
    t = nextTerm(t, includeSummer);
  }
  return terms;
}

/** Upcoming regular semesters, used for the "next semester starts" setting. */
export function upcomingRegularTerms(now: Date = new Date(), count = 4): Term[] {
  return termSequence(defaultStartTerm(now), false, count);
}
