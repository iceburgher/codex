"use client";

import { useMemo, useState } from "react";
import { buildSensitivityMatrix, sweep, type SensitivityMetric } from "@/calculations/sensitivity";
import { formatMoney, formatPercent } from "@/lib/format";
import type { PropertyProject, ScenarioType } from "@/types";
import { Card, SelectField } from "../ui";

const METRIC_OPTIONS: { value: SensitivityMetric; label: string }[] = [
  { value: "after_tax_profit", label: "Vinst efter skatt" },
  { value: "equity_roi", label: "Avkastning" },
  { value: "family_net_worth", label: "Förmögenhetsförändring" },
];

type SweepVariable = "purchasePrice" | "renovation" | "salePrice" | "interestRate" | "holdingPeriod";

const SWEEP_STEPS: Record<SweepVariable, number[]> = {
  purchasePrice: [-0.2, -0.1, 0, 0.1, 0.2],
  renovation: [-0.3, -0.15, 0, 0.15, 0.3],
  salePrice: [-0.2, -0.1, 0, 0.1, 0.2],
  interestRate: [-0.03, -0.015, 0, 0.015, 0.03],
  holdingPeriod: [6, 12, 18, 24, 36],
};

export function SensitivityPanel({
  project,
  scenario,
}: {
  project: PropertyProject;
  scenario: ScenarioType;
}) {
  const [metric, setMetric] = useState<SensitivityMetric>("after_tax_profit");
  const [variable, setVariable] = useState<SweepVariable>("salePrice");

  const matrix = useMemo(
    () => buildSensitivityMatrix({ project, scenario, metric }),
    [project, scenario, metric],
  );

  const sweepPoints = useMemo(
    () => sweep({ project, scenario, variable, steps: SWEEP_STEPS[variable] }),
    [project, scenario, variable],
  );

  const values = matrix.cells.flat().map((c) => c.value);
  const min = Math.min(...values);
  const max = Math.max(...values);

  const format = (v: number) => (metric === "equity_roi" ? formatPercent(v) : formatMoney(v));

  return (
    <div className="grid gap-3 lg:grid-cols-2 print-stack">
      <Card
        title="Om det går sämre — eller bättre"
        subtitle="Renoveringskostnad mot försäljningspris"
        actions={
          <div className="w-44">
            <SelectField<SensitivityMetric>
              label=""
              value={metric}
              options={METRIC_OPTIONS}
              onChange={setMetric}
            />
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="py-1.5 pr-3 text-left font-medium text-muted"></th>
                {matrix.columns.map((c) => (
                  <th key={c} className="py-1.5 pl-3 text-right font-medium text-muted">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.cells.map((row, ri) => (
                <tr key={matrix.rows[ri]}>
                  <td className="py-1.5 pr-3 text-muted">{matrix.rows[ri]}</td>
                  {row.map((cell, ci) => (
                    <td key={ci} className="py-1 pl-1">
                      <div
                        className="numeric rounded px-2 py-1.5 text-right font-medium"
                        style={{ background: heatColor(cell.value, min, max) }}
                      >
                        {format(cell.value)}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card
        title="En sak i taget"
        actions={
          <div className="w-44">
            <SelectField<SweepVariable>
              label=""
              value={variable}
              options={[
                { value: "salePrice", label: "Försäljningspris ±20 %" },
                { value: "purchasePrice", label: "Köpeskilling ±20 %" },
                { value: "renovation", label: "Renovering ±30 %" },
                { value: "interestRate", label: "Ränta ±3 procentenheter" },
                { value: "holdingPeriod", label: "Ägandetid 6–36 mån" },
              ]}
              onChange={setVariable}
            />
          </div>
        }
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="py-2 font-medium text-muted">Ändring</th>
              <th className="py-2 text-right font-medium text-muted">Kvar till er</th>
              <th className="py-2 text-right font-medium text-muted">Avkastning</th>
            </tr>
          </thead>
          <tbody>
            {sweepPoints.map((p) => (
              <tr key={p.label} className="border-b border-border/60 last:border-0">
                <td className="py-1.5">{p.label}</td>
                <td
                  className={`numeric py-1.5 text-right ${p.netProfit < 0 ? "text-negative" : ""}`}
                >
                  {formatMoney(p.netProfit)}
                </td>
                <td className="numeric py-1.5 text-right">{formatPercent(p.equityROI)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function heatColor(value: number, min: number, max: number): string {
  if (max === min) return "var(--surface-muted)";
  const t = (value - min) / (max - min);
  // Red at the worst outcome, green at the best, muted in between.
  const hue = 8 + t * 132;
  return `color-mix(in srgb, hsl(${hue} 55% 45%) 22%, var(--surface))`;
}
