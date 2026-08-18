"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { calculateScenario } from "@/calculations/engine";
import { downloadFile, toCsv } from "@/lib/download";
import { formatMoney, formatPercent, whenAssessable } from "@/lib/format";
import { useProjectStore } from "@/lib/store";
import { ALL_SCENARIOS } from "@/lib/defaults";
import {
  SCENARIO_LABELS,
  type PropertyProject,
  type ScenarioResult,
  type ScenarioType,
} from "@/types";
import { Button, Card, SelectField } from "./ui";

type Mode = "projects" | "scenarios";

interface Column {
  key: string;
  heading: string;
  subheading: string;
  project: PropertyProject;
  result: ScenarioResult;
}

const MAX_COLUMNS = 4;

export function CompareView({ initialIds }: { initialIds: string[] }) {
  const store = useProjectStore();
  const [mode, setMode] = useState<Mode>("projects");
  const [selectedIds, setSelectedIds] = useState<string[]>(initialIds);
  const [scenarioForProjects, setScenarioForProjects] = useState<ScenarioType>("PRIVATE_EQUITY");
  const [singleProjectId, setSingleProjectId] = useState<string>(initialIds[0] ?? "");

  const active = store.projects.filter((p) => !p.archived);

  const columns = useMemo<Column[]>(() => {
    if (mode === "projects") {
      return selectedIds
        .slice(0, MAX_COLUMNS)
        .map((id) => active.find((p) => p.id === id))
        .filter((p): p is PropertyProject => Boolean(p))
        .map((project) => ({
          key: project.id,
          heading: project.name,
          subheading: SCENARIO_LABELS[scenarioForProjects],
          project,
          result: calculateScenario(project, scenarioForProjects),
        }));
    }

    const project = active.find((p) => p.id === singleProjectId);
    if (!project) return [];
    return project.compareScenarios.slice(0, MAX_COLUMNS).map((s) => ({
      key: s,
      heading: SCENARIO_LABELS[s],
      subheading: project.name,
      project,
      result: calculateScenario(project, s),
    }));
  }, [mode, selectedIds, active, scenarioForProjects, singleProjectId]);

  const rows: { label: string; value: (c: Column) => string }[] = [
    { label: "Purchase price", value: (c) => formatMoney(c.project.inputs.purchasePrice) },
    {
      label: "Renovation budget",
      value: (c) => formatMoney(c.result.renovation.renovationTotalGross),
    },
    {
      label: "Total acquisition cost",
      value: (c) => formatMoney(c.result.purchasePrice + c.result.purchaseTaxesFees),
    },
    { label: "Total capital requirement", value: (c) => formatMoney(c.result.totalCapitalRequirement) },
    {
      label: "Peak cash requirement",
      value: (c) => formatMoney(c.result.cashFlow.peakCashRequirement),
    },
    {
      label: "Expected sale price",
      value: (c) =>
        c.project.inputs.expectedSalePrice === null
          ? "Not entered"
          : formatMoney(c.project.inputs.expectedSalePrice),
    },
    { label: "Profit before tax", value: exit((c) => formatMoney(c.result.profitBeforeTax)) },
    { label: "Profit after tax", value: exit((c) => formatMoney(c.result.profitAfterTax)) },
    {
      label: "Private net proceeds",
      value: afterExtraction((c) => formatMoney(c.result.netAvailablePrivately)),
    },
    {
      label: "Cash remaining in company",
      value: exit((c) => formatMoney(c.result.netRetainedInCompany)),
    },
    { label: "Equity invested", value: (c) => formatMoney(c.result.equityCommitted) },
    { label: "Equity ROI", value: afterExtraction((c) => formatPercent(c.result.roi.equityROI)) },
    {
      label: "Annualized ROI",
      value: afterExtraction((c) =>
        c.result.roi.annualizedEquityROI === null
          ? "n/a"
          : formatPercent(c.result.roi.annualizedEquityROI),
      ),
    },
    {
      label: "Break-even sale price",
      value: (c) => formatMoney(c.result.breakEven.breakEvenSalePrice),
    },
    {
      label: "Margin of safety",
      value: (c) => {
        const be = c.result.breakEven.breakEvenSalePrice;
        const sale = c.project.inputs.expectedSalePrice;
        if (be === null || sale === null || sale <= 0) return "Needs sale price";
        return formatPercent((sale - be) / sale);
      },
    },
    {
      label: "Holding period",
      value: (c) => `${c.project.inputs.holdingPeriodMonths} mo`,
    },
    {
      label: "Risk flags (red / total)",
      value: (c) =>
        `${c.result.riskFlags.filter((f) => f.severity === "high").length} / ${c.result.riskFlags.length}`,
    },
    {
      label: "Family net worth delta (Mode B)",
      value: afterExtraction((c) => formatMoney(c.result.familyNetWorth.familyNetWorthDeltaModeB)),
    },
  ];

  function exportCsv() {
    const data: (string | number)[][] = [
      ["KPI", ...columns.map((c) => `${c.heading} — ${c.subheading}`)],
      ...rows.map((row) => [row.label, ...columns.map((c) => row.value(c))]),
    ];
    downloadFile("project-comparison.csv", toCsv(data), "text/csv");
  }

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Comparison</h1>
          <p className="mt-0.5 text-xs text-muted">
            {mode === "projects"
              ? "Different property projects under the same ownership scenario."
              : "The same property project under different ownership scenarios."}
          </p>
        </div>
        <div className="no-print flex gap-2">
          <Button onClick={exportCsv} disabled={columns.length === 0}>
            Export CSV
          </Button>
          <Button onClick={() => window.print()}>Print</Button>
        </div>
      </div>

      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <SelectField<Mode>
            label="Comparison mode"
            value={mode}
            options={[
              { value: "projects", label: "Projects (same scenario)" },
              { value: "scenarios", label: "Scenarios (same project)" },
            ]}
            onChange={setMode}
          />
          {mode === "projects" ? (
            <SelectField<ScenarioType>
              label="Ownership scenario"
              value={scenarioForProjects}
              options={ALL_SCENARIOS.map((s) => ({ value: s, label: SCENARIO_LABELS[s] }))}
              onChange={setScenarioForProjects}
            />
          ) : (
            <SelectField
              label="Project"
              value={singleProjectId}
              options={[
                { value: "", label: "Select a project" },
                ...active.map((p) => ({ value: p.id, label: p.name })),
              ]}
              onChange={setSingleProjectId}
            />
          )}
        </div>

        {mode === "projects" && (
          <div className="mt-3">
            <p className="mb-1.5 text-xs text-muted">Select 2–4 projects</p>
            <div className="flex flex-wrap gap-2">
              {active.map((p) => {
                const on = selectedIds.includes(p.id);
                const full = selectedIds.length >= MAX_COLUMNS;
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={!on && full}
                    onClick={() =>
                      setSelectedIds((prev) =>
                        prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id],
                      )
                    }
                    className={`rounded-md border px-2.5 py-1.5 text-xs disabled:opacity-40 ${
                      on ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface"
                    }`}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {columns.length < 2 ? (
        <Card title="Select at least two columns to compare">
          <p className="text-xs text-muted">
            {mode === "projects"
              ? "Pick 2–4 projects above."
              : "Pick a project with at least two scenarios enabled."}{" "}
            <Link href="/" className="text-accent underline">
              Back to projects
            </Link>
          </p>
        </Card>
      ) : (
        <Card
          title={mode === "projects" ? "Projects compared" : "Scenarios compared"}
          subtitle={
            mode === "projects"
              ? `All columns use ${SCENARIO_LABELS[scenarioForProjects]}.`
              : "All columns share the same object facts."
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-xs">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-2 pr-3 font-medium text-muted">KPI</th>
                  {columns.map((c) => (
                    <th key={c.key} className="py-2 pl-3 text-right">
                      <div className="font-semibold">{c.heading}</div>
                      <div className="text-[10px] font-normal text-muted">{c.subheading}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label} className="border-b border-border/60 last:border-0">
                    <td className="py-1.5 pr-3 text-muted">{row.label}</td>
                    {columns.map((c) => (
                      <td key={c.key} className="numeric py-1.5 pl-3 text-right">
                        {row.value(c)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

const exit = (render: (c: Column) => string) => (c: Column) =>
  whenAssessable(c.result.salePriceMissing, () => render(c));

const afterExtraction = (render: (c: Column) => string) => (c: Column) =>
  whenAssessable(
    c.result.salePriceMissing || c.result.extractionRateUnknown,
    () => render(c),
    c.result.extractionRateUnknown ? "Needs dividend tax rate" : undefined,
  );
