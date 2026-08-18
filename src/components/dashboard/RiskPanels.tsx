"use client";

import { buildAdvisorQuestions } from "@/calculations/advisorQuestions";
import type { PropertyProject, ScenarioResult, ScenarioType } from "@/types";
import { Card, RiskBadge } from "../ui";

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 } as const;

export function RiskFlagsPanel({
  results,
  onNavigate,
}: {
  results: ScenarioResult[];
  onNavigate?: (section: string) => void;
}) {
  // A flag raised by any compared scenario matters — show it once, tagged.
  const byId = new Map<string, { flag: ScenarioResult["riskFlags"][number]; scenarios: string[] }>();
  for (const r of results) {
    for (const flag of r.riskFlags) {
      const existing = byId.get(flag.id);
      if (existing) existing.scenarios.push(r.label);
      else byId.set(flag.id, { flag, scenarios: [r.label] });
    }
  }

  const flags = [...byId.values()].sort(
    (a, b) => SEVERITY_ORDER[a.flag.severity] - SEVERITY_ORDER[b.flag.severity],
  );

  return (
    <Card
      title="Tax risk & flags"
      subtitle="Classification depends on purpose, facts and usage — these are not settled answers."
    >
      {flags.length === 0 ? (
        <p className="text-xs text-muted">No flags raised.</p>
      ) : (
        <ul className="space-y-2">
          {flags.map(({ flag, scenarios }) => (
            <li key={flag.id} className="flex gap-2.5">
              <RiskBadge severity={flag.severity} />
              <div className="min-w-0">
                <p className="text-xs">{flag.text}</p>
                <p className="mt-0.5 text-[10px] text-muted">
                  {scenarios.join(" · ")}
                  {onNavigate && FLAG_SECTIONS[flag.id] && (
                    <>
                      {" · "}
                      <button
                        type="button"
                        className="text-accent underline underline-offset-2"
                        onClick={() => onNavigate(FLAG_SECTIONS[flag.id])}
                      >
                        Go to input
                      </button>
                    </>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

const FLAG_SECTIONS: Record<string, string> = {
  sale_price_missing: "Sale",
  tax_assessment_missing: "Purchase",
  mortgage_deeds_missing: "Purchase",
  short_holding_period: "Purchase",
  explicit_flip_intent: "Tax classification",
  private_residence_classification_unconfirmed: "Tax classification",
  no_private_use: "Tax classification",
  company_private_use_risk: "Private use / benefit",
  vat_deduction_claimed_on_residence: "VAT",
  vat_default_zero: "VAT",
  high_intercompany_debt: "Project company funding",
  dividend_allowance_exceeded: "Dividend extraction",
};

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
    <Card title="Warnings" subtitle="Warnings never block calculation.">
      <ul className="space-y-1.5">
        {[...seen.entries()].map(([id, w]) => (
          <li key={id} className="text-xs">
            <span className="text-warn">▲</span> {w.text}
            <span className="ml-1 text-[10px] text-muted">({w.scenarios.join(", ")})</span>
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
      title="Advisor questions"
      subtitle="Generated from the scenarios and inputs currently in use."
    >
      <ul className="space-y-2">
        {questions.map((q) => (
          <li key={q.id} className="text-xs">
            <span className="mr-1.5 rounded bg-surface-muted px-1.5 py-0.5 text-[10px] text-muted">
              {q.scope}
            </span>
            {q.question}
          </li>
        ))}
      </ul>
    </Card>
  );
}
