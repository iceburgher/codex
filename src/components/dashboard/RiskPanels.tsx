"use client";

import { buildAdvisorQuestions } from "@/calculations/advisorQuestions";
import type { PropertyProject, RiskFlag, ScenarioResult, ScenarioType } from "@/types";
import { Card, RiskDot } from "../ui";

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 } as const;

interface GroupedFlag {
  flag: RiskFlag;
  scenarios: string[];
}

function groupFlags(results: ScenarioResult[]): GroupedFlag[] {
  const byId = new Map<string, GroupedFlag>();
  for (const r of results) {
    for (const flag of r.riskFlags) {
      const existing = byId.get(flag.id);
      if (existing) existing.scenarios.push(r.label);
      else byId.set(flag.id, { flag, scenarios: [r.label] });
    }
  }
  return [...byId.values()].sort(
    (a, b) => SEVERITY_ORDER[a.flag.severity] - SEVERITY_ORDER[b.flag.severity],
  );
}

/** Kort lista med det viktigaste — resten ligger under Detaljer. */
export function TopRisks({
  results,
  limit = 3,
  onShowAll,
}: {
  results: ScenarioResult[];
  limit?: number;
  onShowAll?: () => void;
}) {
  const flags = groupFlags(results);
  const shown = flags.slice(0, limit);
  const rest = flags.length - shown.length;

  return (
    <Card
      title="Att tänka på"
      subtitle="Skattereglerna beror på syfte, användning och omständigheter. Det här är inte färdiga svar."
    >
      {shown.length === 0 ? (
        <p className="text-sm text-muted">Inga frågetecken hittade.</p>
      ) : (
        <ul className="space-y-3">
          {shown.map(({ flag, scenarios }) => (
            <li key={flag.id} className="flex gap-3">
              <RiskDot severity={flag.severity} />
              <div>
                <p className="text-sm leading-relaxed">{flag.text}</p>
                <p className="mt-0.5 text-xs text-muted">{scenarios.join(" · ")}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {rest > 0 && onShowAll && (
        <button
          type="button"
          onClick={onShowAll}
          className="mt-4 text-sm font-medium text-accent hover:underline"
        >
          Visa alla {flags.length} punkter
        </button>
      )}
    </Card>
  );
}

export function RiskFlagsPanel({ results }: { results: ScenarioResult[] }) {
  const flags = groupFlags(results);

  return (
    <Card
      title="Alla frågetecken"
      subtitle="Rött betyder: ta in skatteråd innan du litar på siffran. Gult betyder: kontrollera."
    >
      {flags.length === 0 ? (
        <p className="text-sm text-muted">Inga frågetecken hittade.</p>
      ) : (
        <ul className="space-y-3">
          {flags.map(({ flag, scenarios }) => (
            <li key={flag.id} className="flex gap-3">
              <RiskDot severity={flag.severity} />
              <div>
                <p className="text-sm leading-relaxed">{flag.text}</p>
                <p className="mt-0.5 text-xs text-muted">{scenarios.join(" · ")}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function WarningsPanel({ results }: { results: ScenarioResult[] }) {
  const seen = new Map<string, { text: string; scenarios: string[] }>();
  for (const r of results) {
    for (const w of r.warnings) {
      const existing = seen.get(w.id);
      if (existing) existing.scenarios.push(r.label);
      else seen.set(w.id, { text: w.text, scenarios: [r.label] });
    }
  }

  if (seen.size === 0) return null;

  return (
    <Card title="Varningar" subtitle="Varningar stoppar aldrig beräkningen.">
      <ul className="space-y-2.5">
        {[...seen.entries()].map(([id, w]) => (
          <li key={id} className="text-sm leading-relaxed">
            <span className="mr-1.5 text-warn">▲</span>
            {w.text}
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function AdvisorQuestionsPanel({
  project,
  scenarios,
}: {
  project: PropertyProject;
  scenarios: ScenarioType[];
}) {
  const questions = buildAdvisorQuestions(project, scenarios);

  return (
    <Card
      title="Frågor att ta med till rådgivaren"
      subtitle="Skapas utifrån de ägarformer och uppgifter ni faktiskt använder."
    >
      <ul className="space-y-3">
        {questions.map((q) => (
          <li key={q.id} className="text-sm leading-relaxed">
            <span className="mr-2 rounded-md bg-surface-muted px-2 py-0.5 text-xs text-muted">
              {q.scope}
            </span>
            {q.question}
          </li>
        ))}
      </ul>
    </Card>
  );
}
