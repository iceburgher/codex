"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { calculateScenario } from "@/calculations/engine";
import { downloadFile, slugify, toCsv } from "@/lib/download";
import { formatMoney, formatPercent } from "@/lib/format";
import { useProjectStore } from "@/lib/store";
import {
  OPTIMIZATION_TARGET_LABELS,
  SCENARIO_LABELS,
  type OptimizationTarget,
  type PropertyProject,
  type ScenarioResult,
  type ScenarioType,
} from "@/types";
import { ALL_SCENARIOS } from "@/lib/defaults";
import { ObjectInputs } from "./inputs/ObjectInputs";
import { ScenarioInputsPanel } from "./inputs/ScenarioInputsPanel";
import { CashFlowChart, CostWaterfall, ScenarioBarCharts } from "./dashboard/Charts";
import { ComparisonTable } from "./dashboard/ComparisonTable";
import { AdvisorQuestionsPanel, RiskFlagsPanel, WarningsPanel } from "./dashboard/RiskPanels";
import { ScenarioCards, bestScenarioIndex } from "./dashboard/ScenarioCards";
import { SensitivityPanel } from "./dashboard/SensitivityPanel";
import { Button, Card, SelectField, Stat, ToggleField } from "./ui";

export function ProjectDashboard({ projectId }: { projectId: string }) {
  const store = useProjectStore();
  const project = store.getProject(projectId);
  const [activeScenario, setActiveScenario] = useState<ScenarioType | null>(null);

  const results = useMemo<ScenarioResult[]>(() => {
    if (!project) return [];
    return project.compareScenarios.map((s) => calculateScenario(project, s));
  }, [project]);

  if (store.loading) {
    return <p className="p-6 text-sm text-muted">Loading…</p>;
  }

  if (!project) {
    return (
      <div className="p-6">
        <Card title="Project not found">
          <p className="text-xs text-muted">
            This project no longer exists.{" "}
            <Link href="/" className="text-accent underline">
              Back to projects
            </Link>
          </p>
        </Card>
      </div>
    );
  }

  const selectedScenario = activeScenario ?? project.selectedScenario;
  const selectedResult =
    results.find((r) => r.scenario === selectedScenario) ?? results[0] ?? null;

  const update = (updater: (draft: PropertyProject) => void) => {
    const draft: PropertyProject = JSON.parse(JSON.stringify(project));
    updater(draft);
    store.updateProject(draft);
  };

  const best = bestScenarioIndex(results, project.optimizationTarget);
  const currentName = project.name;

  function exportCsv() {
    const header = ["KPI", ...results.map((r) => r.label)];
    const rows: (string | number)[][] = [
      header,
      ["Purchase price", ...results.map((r) => Math.round(r.purchasePrice))],
      ["Total capital requirement", ...results.map((r) => Math.round(r.totalCapitalRequirement))],
      ["Equity committed", ...results.map((r) => Math.round(r.equityCommitted))],
      ["External debt", ...results.map((r) => Math.round(r.externalDebt))],
      ["Purchase taxes/fees", ...results.map((r) => Math.round(r.purchaseTaxesFees))],
      ["Renovation cash cost", ...results.map((r) => Math.round(r.renovationCashCost))],
      ["Financing cost", ...results.map((r) => Math.round(r.financingCost))],
      ["Running costs", ...results.map((r) => Math.round(r.runningCostsTotal))],
      ["Total project cost", ...results.map((r) => Math.round(r.totalProjectCost))],
      ["Sale price", ...results.map((r) => Math.round(r.salePrice))],
      ["Profit before tax", ...results.map((r) => Math.round(r.profitBeforeTax))],
      ["Tax", ...results.map((r) => Math.round(r.totalTax))],
      ["Profit after tax", ...results.map((r) => Math.round(r.profitAfterTax))],
      ["Net retained in company", ...results.map((r) => Math.round(r.netRetainedInCompany))],
      ["Net available privately", ...results.map((r) => Math.round(r.netAvailablePrivately))],
      ["Equity ROI", ...results.map((r) => r.roi.equityROI.toFixed(4))],
      [
        "Annualized equity ROI",
        ...results.map((r) => (r.roi.annualizedEquityROI ?? 0).toFixed(4)),
      ],
      [
        "Break-even sale price",
        ...results.map((r) => Math.round(r.breakEven.breakEvenSalePrice ?? 0)),
      ],
      [
        "Family net worth delta (Mode B)",
        ...results.map((r) => Math.round(r.familyNetWorth.familyNetWorthDeltaModeB)),
      ],
    ];
    downloadFile(`${slugify(currentName)}-comparison.csv`, toCsv(rows), "text/csv");
  }

  async function exportJson() {
    const json = await store.exportProjects([projectId]);
    downloadFile(`${slugify(currentName)}.json`, json, "application/json");
  }

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-5">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/" className="no-print text-[11px] text-accent hover:underline">
            ← Projects
          </Link>
          <h1 className="mt-1 text-lg font-semibold tracking-tight">{project.name}</h1>
          <p className="text-xs text-muted">
            {project.facts.address ?? "No address"}
            {project.facts.municipality ? ` · ${project.facts.municipality}` : ""} · Tax year{" "}
            {project.taxConfigSnapshot?.taxYear ?? 2026}
          </p>
        </div>
        <div className="no-print flex flex-wrap items-center gap-2">
          <span
            className={`rounded px-2 py-1 text-[11px] font-medium ${
              store.saveState === "saved"
                ? "bg-ok-soft text-positive"
                : "bg-warn-soft text-warn"
            }`}
          >
            {store.saveState === "saved"
              ? "Saved"
              : store.saveState === "saving"
                ? "Saving…"
                : "Unsaved changes"}
          </span>
          <Button onClick={() => void store.saveNow()}>Save</Button>
          <Button onClick={exportJson}>Export JSON</Button>
          <Button onClick={exportCsv}>Export CSV</Button>
          <Button onClick={() => window.print()}>Print summary</Button>
        </div>
      </header>

      <Card className="mb-4">
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Purchase price" value={formatMoney(project.inputs.purchasePrice)} />
          <Stat
            label="Expected sale price"
            value={
              project.inputs.expectedSalePrice === null
                ? "Missing"
                : formatMoney(project.inputs.expectedSalePrice)
            }
            tone={project.inputs.expectedSalePrice === null ? "negative" : "neutral"}
          />
          <Stat
            label="Renovation (gross)"
            value={formatMoney(selectedResult?.renovation.renovationTotalGross ?? 0)}
          />
          <Stat label="Holding period" value={`${project.inputs.holdingPeriodMonths} mo`} />
          <Stat
            label={`Best on ${OPTIMIZATION_TARGET_LABELS[project.optimizationTarget].toLowerCase()}`}
            value={best >= 0 ? results[best].label : "Not determinable"}
            hint={best >= 0 ? undefined : "Missing inputs — see flags"}
          />
          <div className="no-print">
            <SelectField<OptimizationTarget>
              label="Optimize for"
              value={project.optimizationTarget}
              options={(Object.keys(OPTIMIZATION_TARGET_LABELS) as OptimizationTarget[]).map(
                (t) => ({ value: t, label: OPTIMIZATION_TARGET_LABELS[t] }),
              )}
              onChange={(v) => update((d) => void (d.optimizationTarget = v))}
              hint={
                project.optimizationTarget === "min_tax"
                  ? "Lowest tax is not the same as the best economic outcome."
                  : undefined
              }
            />
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr] print-full-width">
        <aside className="no-print space-y-3">
          <Card title="Compared scenarios">
            <div className="space-y-2">
              {ALL_SCENARIOS.map((s) => (
                <ToggleField
                  key={s}
                  label={SCENARIO_LABELS[s]}
                  value={project.compareScenarios.includes(s)}
                  onChange={(on) =>
                    update((d) => {
                      d.compareScenarios = on
                        ? [...ALL_SCENARIOS.filter((x) => d.compareScenarios.includes(x) || x === s)]
                        : d.compareScenarios.filter((x) => x !== s);
                      if (!d.compareScenarios.includes(d.selectedScenario)) {
                        d.selectedScenario = d.compareScenarios[0] ?? "PRIVATE_EQUITY";
                      }
                    })
                  }
                />
              ))}
            </div>
          </Card>

          <div>
            <h2 className="mb-2 px-1 text-xs font-semibold">Object assumptions</h2>
            <ObjectInputs project={project} update={update} />
          </div>

          <div>
            <h2 className="mb-2 px-1 text-xs font-semibold">Scenario assumptions</h2>
            <div className="mb-2">
              <SelectField<ScenarioType>
                label="Editing scenario"
                value={selectedScenario}
                options={project.compareScenarios.map((s) => ({
                  value: s,
                  label: SCENARIO_LABELS[s],
                }))}
                onChange={(v) => {
                  setActiveScenario(v);
                  update((d) => void (d.selectedScenario = v));
                }}
              />
            </div>
            <ScenarioInputsPanel
              project={project}
              scenarioType={selectedScenario}
              update={update}
            />
          </div>
        </aside>

        <div className="space-y-4">
          {results.length === 0 ? (
            <Card title="No scenarios selected">
              <p className="text-xs text-muted">Enable at least one scenario to see results.</p>
            </Card>
          ) : (
            <>
              <ScenarioCards results={results} target={project.optimizationTarget} />
              <ThreeQuestions results={results} />
              <ComparisonTable results={results} />
              <ScenarioBarCharts results={results} />
              <CashFlowChart results={results} />
              {selectedResult && (
                <div className="grid gap-3 lg:grid-cols-2 print-stack">
                  <CostWaterfall result={selectedResult} />
                  <TaxBreakdown result={selectedResult} />
                </div>
              )}
              <SensitivityPanel project={project} scenario={selectedScenario} />
              <div className="grid gap-3 lg:grid-cols-2 print-stack">
                <RiskFlagsPanel results={results} />
                <div className="space-y-3">
                  <WarningsPanel results={results} />
                  <AdvisorQuestionsPanel
                    project={project}
                    scenarios={project.compareScenarios}
                  />
                </div>
              </div>
              {selectedResult && <CashFlowTable result={selectedResult} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** The three questions the spec insists are not the same question. */
function ThreeQuestions({ results }: { results: ScenarioResult[] }) {
  const bestProfit = pick(results, (r) => r.profitAfterTax);
  const bestCompany = pick(results, (r) => r.netRetainedInCompany);
  // Only structures whose owner-level extraction tax is known can answer C.
  const familyCandidates = results.filter((r) => !r.extractionRateUnknown);
  const bestFamily = familyCandidates.length > 0 ? pick(familyCandidates, (r) => r.familyNetWorth.familyNetWorthDeltaModeB) : null;

  if (results.every((r) => r.salePriceMissing)) {
    return (
      <Card title="Three separate questions">
        <p className="text-xs text-warn">
          Enter an expected sale price to rank the structures. Costs, capital requirement and
          break-even prices below are already assessable without it.
        </p>
      </Card>
    );
  }

  return (
    <Card
      title="Three separate questions"
      subtitle="Highest project profit, most capital left in the company, and highest after-tax family net worth are not the same answer."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Answer
          question="A. Highest project profit?"
          answer={bestProfit.label}
          value={formatMoney(bestProfit.profitAfterTax)}
        />
        <Answer
          question="B. Most capital inside the company?"
          answer={bestCompany.label}
          value={formatMoney(bestCompany.netRetainedInCompany)}
        />
        <Answer
          question="C. Highest after-tax family net worth?"
          answer={bestFamily ? bestFamily.label : "Not determinable"}
          value={
            bestFamily
              ? formatMoney(bestFamily.familyNetWorth.familyNetWorthDeltaModeB)
              : "Supply the dividend tax rate above the allowance"
          }
          headline
        />
      </div>
    </Card>
  );
}

function Answer({
  question,
  answer,
  value,
  headline,
}: {
  question: string;
  answer: string;
  value: string;
  headline?: boolean;
}) {
  return (
    <div
      className={`rounded-md p-3 ${headline ? "bg-accent-soft" : "bg-surface-muted"}`}
    >
      <p className="text-[11px] text-muted">{question}</p>
      <p className="mt-1 text-sm font-semibold">{answer}</p>
      <p className="numeric text-xs text-muted">{value}</p>
      {headline && (
        <p className="mt-1 text-[10px] font-medium text-accent">Default recommendation basis</p>
      )}
    </div>
  );
}

function pick(results: ScenarioResult[], score: (r: ScenarioResult) => number): ScenarioResult {
  return results.reduce((best, r) => (score(r) > score(best) ? r : best), results[0]);
}

function TaxBreakdown({ result }: { result: ScenarioResult }) {
  const rows: [string, number][] = result.corporateTax
    ? [
        ["Corporate tax", result.corporateTax.companyTax],
        ["Owner extraction tax", result.extraction?.ownerExtractionTax ?? 0],
        ["Owner benefit tax", result.benefit?.ownerBenefitTax ?? 0],
        [
          "Employer contributions on benefit",
          result.benefit?.companyEmployerContributionOnBenefit ?? 0,
        ],
      ]
    : [
        ["Capital gains tax", result.capitalGain.capitalGainTax],
        ["Rental income tax", result.rental.privateRentalTax],
        ["Dividend tax on funding", result.dividend?.dividendTax ?? 0],
        [
          "Salary cost above net (tax + contributions)",
          result.salary ? result.salary.companyCashCost - result.salary.grossSalary : 0,
        ],
      ];

  const total = rows.reduce((s, [, v]) => s + v, 0);

  return (
    <Card title="Tax & fee breakdown" subtitle={result.label}>
      <table className="w-full text-xs">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label} className="border-b border-border/60 last:border-0">
              <td className="py-1.5 text-muted">{label}</td>
              <td className="numeric py-1.5 text-right">{formatMoney(value)}</td>
            </tr>
          ))}
          <tr className="border-t border-border font-semibold">
            <td className="py-1.5">Total</td>
            <td className="numeric py-1.5 text-right">{formatMoney(total)}</td>
          </tr>
        </tbody>
      </table>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Stat
          label="Effective tax on profit before tax"
          value={
            result.profitBeforeTax > 0
              ? formatPercent(result.totalTax / result.profitBeforeTax)
              : "n/a"
          }
        />
        <Stat
          label="Peak debt"
          value={formatMoney(result.cashFlow.peakDebt)}
          hint={`Max funding need in month ${result.cashFlow.monthOfMaxFundingNeed}`}
        />
      </div>
    </Card>
  );
}

function CashFlowTable({ result }: { result: ScenarioResult }) {
  return (
    <Card
      title="Monthly cash flow"
      subtitle={`${result.label} — amortization reduces debt but is not a project expense.`}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-[11px]">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="py-1.5 pr-2">Month</th>
              <th className="py-1.5 pr-2 text-right">Opening</th>
              <th className="py-1.5 pr-2 text-right">Loan</th>
              <th className="py-1.5 pr-2 text-right">Purchase</th>
              <th className="py-1.5 pr-2 text-right">Renovation</th>
              <th className="py-1.5 pr-2 text-right">Running</th>
              <th className="py-1.5 pr-2 text-right">Interest</th>
              <th className="py-1.5 pr-2 text-right">Rental</th>
              <th className="py-1.5 pr-2 text-right">Sale</th>
              <th className="py-1.5 pr-2 text-right">Taxes</th>
              <th className="py-1.5 pr-2 text-right">Amort.</th>
              <th className="py-1.5 text-right">Closing</th>
            </tr>
          </thead>
          <tbody>
            {result.cashFlow.months.map((m) => (
              <tr key={m.month} className="border-b border-border/50 last:border-0">
                <td className="py-1 pr-2">{m.month}</td>
                <td className="numeric py-1 pr-2 text-right">{formatMoney(m.openingCash)}</td>
                <td className="numeric py-1 pr-2 text-right">{formatMoney(m.loanDrawdown)}</td>
                <td className="numeric py-1 pr-2 text-right">{formatMoney(-m.purchaseCost)}</td>
                <td className="numeric py-1 pr-2 text-right">{formatMoney(-m.renovationSpend)}</td>
                <td className="numeric py-1 pr-2 text-right">{formatMoney(-m.runningCost)}</td>
                <td className="numeric py-1 pr-2 text-right">{formatMoney(-m.interest)}</td>
                <td className="numeric py-1 pr-2 text-right">{formatMoney(m.rentalIncome)}</td>
                <td className="numeric py-1 pr-2 text-right">{formatMoney(m.saleIncome)}</td>
                <td className="numeric py-1 pr-2 text-right">{formatMoney(-m.taxes)}</td>
                <td className="numeric py-1 pr-2 text-right">{formatMoney(-m.amortization)}</td>
                <td
                  className={`numeric py-1 text-right font-medium ${
                    m.closingCash < 0 ? "text-negative" : ""
                  }`}
                >
                  {formatMoney(m.closingCash)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Peak cash requirement" value={formatMoney(result.cashFlow.peakCashRequirement)} />
        <Stat label="Peak debt" value={formatMoney(result.cashFlow.peakDebt)} />
        <Stat label="Equity required" value={formatMoney(result.cashFlow.equityRequired)} />
        <Stat label="Total interest" value={formatMoney(result.cashFlow.totalInterest)} />
      </div>
    </Card>
  );
}
