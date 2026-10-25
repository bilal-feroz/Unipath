import Link from "next/link";
import { LogoMark } from "@/components/logo";
import { curricula, getUniversity } from "@/lib/curriculum/registry";
import { site } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="glass-bar border-t border-line">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.3fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <LogoMark className="size-6" />
            <span className="font-semibold">UniPath</span>
          </div>
          <p className="mt-3 max-w-sm text-sm text-muted">
            A degree planner that turns static study plans into a personal roadmap. {site.tagline}
          </p>
          <p className="mt-4 max-w-sm text-[13px] leading-relaxed text-dim">{site.disclaimer}</p>
        </div>
        <div>
          <h2 className="text-[12.5px] font-medium text-muted">Curriculum data</h2>
          <ul className="mt-3 space-y-1.5 text-sm text-muted">
            {curricula.map((c) => (
              <li key={c.id}>
                {c.degree} in {c.majorName} — {getUniversity(c.universityId)?.name} study plan
              </li>
            ))}
          </ul>
          <Link href="/about" className="mt-3 inline-block text-sm font-medium text-accent hover:text-accent-strong">
            Sources and data notes →
          </Link>
        </div>
        <div>
          <h2 className="text-[12.5px] font-medium text-muted">Project</h2>
          <ul className="mt-3 space-y-1.5 text-sm text-muted">
            <li>Built for {site.hackathon}</li>
            <li>Team: {site.team.join(", ")}</li>
            <li>
              <a href={site.github} className="hover:text-fg" target="_blank" rel="noreferrer">
                Source code on GitHub ↗
              </a>
            </li>
            <li>
              <Link href="/about#how-it-works" className="hover:text-fg">
                How the planner works
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
