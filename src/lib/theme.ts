import { THEME_KEY } from "@/lib/state/schema";

export type ThemeChoice = "dark" | "light";

/** Runs before first paint (inlined in <head>) so the page never flashes the wrong theme. */
export const themeScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});document.documentElement.setAttribute("data-theme",t==="light"?"light":"dark")}catch(e){document.documentElement.setAttribute("data-theme","dark")}})()`;

export function currentTheme(): ThemeChoice {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

export function setTheme(theme: ThemeChoice) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Theme still applies for this visit.
  }
}

/**
 * A wobbly, liquid-looking circle as a CSS polygon. Every frame uses the same number of points,
 * so the browser can interpolate smoothly between frames.
 */
function blob(cx: number, cy: number, r: number, phase: number, wobble: number, twist: number): string {
  const POINTS = 72;
  const pts: string[] = [];
  for (let i = 0; i < POINTS; i++) {
    const a = (i / POINTS) * Math.PI * 2;
    const noise =
      0.5 * Math.sin(3 * a + phase * 5.1) + 0.3 * Math.sin(5 * a - phase * 3.7 + 1.3) + 0.2 * Math.sin(7 * a + phase * 2.3 + 0.7);
    const rr = Math.max(0, r * (1 + wobble * noise));
    const angle = a + twist;
    pts.push(`${(cx + rr * Math.cos(angle)).toFixed(1)}px ${(cy + rr * Math.sin(angle)).toFixed(1)}px`);
  }
  return `polygon(${pts.join(",")})`;
}

const FRAMES = 30;
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Dark oozes out of the toggle: a small droplet swells, wobbles, then floods the screen and settles. */
function oozeFrames(x: number, y: number, cover: number, start: number): string[] {
  return Array.from({ length: FRAMES + 1 }, (_, k) => {
    const p = k / FRAMES;
    const r = start + (cover - start) * easeInOutCubic(p);
    return blob(x, y, r, p * 2.4, 0.24 * Math.pow(1 - p, 1.3), 0);
  });
}

/** Dark gets sucked into the toggle: it accelerates inward, twisting and wobbling like water down a drain. */
function suckFrames(x: number, y: number, cover: number): string[] {
  return Array.from({ length: FRAMES + 1 }, (_, k) => {
    const p = k / FRAMES;
    const r = cover * (1 - Math.pow(p, 2.1));
    return blob(x, y, r, p * 3.2, 0.05 + 0.32 * p * p, 2.6 * p * p);
  });
}

/**
 * Switches theme. With View Transitions available (and motion allowed), the dark colour oozes out
 * of `origin` when going dark and is sucked back into it when going light.
 */
export function toggleTheme(origin?: HTMLElement | null) {
  const next: ThemeChoice = currentTheme() === "dark" ? "light" : "dark";
  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!("startViewTransition" in document) || reduceMotion) {
    setTheme(next);
    return;
  }

  const rect = origin?.getBoundingClientRect();
  const x = rect ? rect.left + rect.width / 2 : window.innerWidth - 48;
  const y = rect ? rect.top + rect.height / 2 : 32;
  const cover = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y)) * 1.12;
  const start = rect ? Math.min(rect.width, rect.height) / 2 : 16;

  root.dataset.themeTransition = next === "dark" ? "ooze" : "suck";
  const transition = document.startViewTransition(() => setTheme(next));
  transition.ready
    .then(() => {
      if (next === "dark") {
        root.animate(
          { clipPath: oozeFrames(x, y, cover, start) },
          { duration: 1050, easing: "linear", pseudoElement: "::view-transition-new(root)" },
        );
      } else {
        root.animate(
          { clipPath: suckFrames(x, y, cover) },
          { duration: 850, easing: "linear", pseudoElement: "::view-transition-old(root)" },
        );
      }
    })
    .catch(() => {});
  transition.finished.finally(() => {
    delete root.dataset.themeTransition;
  });
}
