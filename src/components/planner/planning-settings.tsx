"use client";

import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { termKey, termLabel, parseTermKey, upcomingRegularTerms } from "@/lib/engine";
import type { Preferences } from "@/lib/state/schema";
import { useAppStore } from "@/lib/state/store";

export const LOAD_OPTIONS = [9, 12, 15, 18, 21].map((n) => ({
  value: n,
  label: String(n),
  hint: `${n} credit hours per semester`,
}));

export function PlanningSettingsFields({ preferences }: { preferences: Preferences }) {
  const setPreferences = useAppStore((s) => s.setPreferences);
  const terms = upcomingRegularTerms(new Date(), 4);
  const startKey = termKey(preferences.startTerm);
  if (!terms.some((t) => termKey(t) === startKey)) terms.unshift(preferences.startTerm);

  return (
    <div className="space-y-6">
      <div>
        <p id="load-label" className="text-sm font-medium text-fg">
          Credit hours per semester
        </p>
        <p className="mb-2.5 mt-0.5 text-[13px] text-muted">
          The most you want to take in a fall or spring semester. The official guidance plan uses about 18.
        </p>
        <Segmented
          label="Credit hours per semester"
          value={preferences.maxCredits}
          onChange={(v) => setPreferences({ maxCredits: v })}
          options={LOAD_OPTIONS}
        />
      </div>

      <Switch
        checked={preferences.includeSummer}
        onChange={(v) => setPreferences({ includeSummer: v })}
        label="Study in summer"
        description="Plan summer terms between spring and fall."
      />

      {preferences.includeSummer && (
        <div>
          <p className="text-sm font-medium text-fg">Summer credit hours</p>
          <p className="mb-2.5 mt-0.5 text-[13px] text-muted">Check your university&apos;s summer limit.</p>
          <Segmented
            label="Summer credit hours"
            value={preferences.summerMaxCredits}
            onChange={(v) => setPreferences({ summerMaxCredits: v })}
            options={[3, 6, 9].map((n) => ({ value: n, label: String(n) }))}
          />
        </div>
      )}

      <div>
        <label htmlFor="start-term" className="text-sm font-medium text-fg">
          Next semester
        </label>
        <p className="mb-2.5 mt-0.5 text-[13px] text-muted">The first semester UniPath plans for you.</p>
        <Select
          id="start-term"
          label="Next semester"
          value={startKey}
          onChange={(e) => {
            const term = parseTermKey(e.target.value);
            if (term) setPreferences({ startTerm: term });
          }}
          className="w-full sm:w-56"
        >
          {terms.map((t) => (
            <option key={termKey(t)} value={termKey(t)}>
              {termLabel(t)}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
