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
    { label: "Köpeskilling", value: (c) => formatMoney(c.project.inputs.purchasePrice) },
    {
      label: "Renoveringsbudget",
      value: (c) => formatMoney(c.result.renovation.renovationTotalGross),
    },
    {
      label: "Total anskaffningskostnad",
      value: (c) => formatMoney(c.result.purchasePrice + c.result.purchaseTaxesFees),
    },
    {
      label: "Totalt kapitalbehov",
      value: (c) => formatMoney(c.result.totalCapitalRequirement),
    },
    {
      label: "Kapital som binds",
      value: (c) => formatMoney(c.result.cashFlow.peakCashRequirement),
    },
    {
      label: "Förväntat försäljningspris",
      value: (c) =>
        c.project.inputs.expectedSalePrice === null
          ? "Ej ifyllt"
          : formatMoney(c.project.inputs.expectedSalePrice),
    },
    { label: "Vinst före skatt", value: exit((c) => formatMoney(c.result.profitBeforeTax)) },
    { label: "Vinst efter skatt", value: exit((c) => formatMoney(c.result.profitAfterTax)) },
    {
      label: "Kvar till er privat",
      value: afterExtraction((c) => formatMoney(c.result.netAvailablePrivately)),
    },
    {
      label: "Kvar i bolaget",
      value: exit((c) => formatMoney(c.result.netRetainedInCompany)),
    },
    { label: "Insatt eget kapital", value: (c) => formatMoney(c.result.equityCommitted) },
    {
      label: "Avkastning på insatt kapital",
      value: afterExtraction((c) => formatPercent(c.result.roi.equityROI)),
    },
    {
      label: "Motsvarande per år",
      value: afterExtraction((c) =>
        c.result.roi.annualizedEquityROI === null
          ? "—"
          : formatPercent(c.result.roi.annualizedEquityROI),
      ),
    },
    {
      label: "Nollpris vid försäljning",
      value: (c) => formatMoney(c.result.breakEven.breakEvenSalePrice),
    },
    {
      label: "Marginal till nollpris",
      value: (c) => {
        const be = c.result.breakEven.breakEvenSalePrice;
        const sale = c.project.inputs.expectedSalePrice;
        if (be === null || sale === null || sale <= 0) return "Kräver försäljningspris";
        return formatPercent((sale - be) / sale);
      },
    },
    {
      label: "Ägandetid",
      value: (c) => `${c.project.inputs.holdingPeriodMonths} mån`,
    },
    {
      label: "Frågetecken (röda / totalt)",
      value: (c) =>
        `${c.result.riskFlags.filter((f) => f.severity === "high").length} / ${c.result.riskFlags.length}`,
    },
    {
      label: "Förmögenhetsförändring, allt uttaget",
      value: afterExtraction((c) => formatMoney(c.result.familyNetWorth.familyNetWorthDeltaModeB)),
    },
  ];

  function exportCsv() {
    const data: (string | number)[][] = [
      ["Nyckeltal", ...columns.map((c) => `${c.heading} — ${c.subheading}`)],
      ...rows.map((row) => [row.label, ...columns.map((c) => row.value(c))]),
    ];
    downloadFile("jamforelse.csv", toCsv(data), "text/csv");
  }

  return (
    <div className="mx-auto max-w-[1400px] px-5 py-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Jämförelse</h1>
          <p className="mt-0.5 text-xs text-muted">
            {mode === "projects"
              ? "Olika objekt under samma ägarform."
              : "Samma objekt under olika ägarformer."}
          </p>
        </div>
        <div className="no-print flex gap-2">
          <Button onClick={exportCsv} disabled={columns.length === 0}>
            Exportera CSV
          </Button>
          <Button onClick={() => window.print()}>Skriv ut</Button>
        </div>
      </div>

      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <SelectField<Mode>
            label="Vad vill du jämföra?"
            value={mode}
            options={[
              { value: "projects", label: "Olika objekt, samma ägarform" },
              { value: "scenarios", label: "Samma objekt, olika ägarform" },
            ]}
            onChange={setMode}
          />
          {mode === "projects" ? (
            <SelectField<ScenarioType>
              label="Ägarform"
              value={scenarioForProjects}
              options={ALL_SCENARIOS.map((s) => ({ value: s, label: SCENARIO_LABELS[s] }))}
              onChange={setScenarioForProjects}
            />
          ) : (
            <SelectField
              label="Objekt"
              value={singleProjectId}
              options={[
                { value: "", label: "Välj ett objekt" },
                ...active.map((p) => ({ value: p.id, label: p.name })),
              ]}
              onChange={setSingleProjectId}
            />
          )}
        </div>

        {mode === "projects" && (
          <div className="mt-3">
            <p className="mb-2 text-sm text-muted">Välj 2–4 objekt</p>
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
        <Card title="Välj minst två att jämföra">
          <p className="text-xs text-muted">
            {mode === "projects"
              ? "Markera 2–4 objekt ovan."
              : "Välj ett objekt som har minst två ägarformer påslagna."}{" "}
            <Link href="/" className="text-accent underline">
              Tillbaka till projekten
            </Link>
          </p>
        </Card>
      ) : (
        <Card
          title={mode === "projects" ? "Objekten sida vid sida" : "Ägarformerna sida vid sida"}
          subtitle={
            mode === "projects"
              ? `Alla kolumner räknas som ${SCENARIO_LABELS[scenarioForProjects]}.`
              : "Alla kolumner utgår från samma uppgifter om objektet."
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-2 pr-3 font-medium text-muted">Nyckeltal</th>
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
                    <td className="py-2 pr-3 text-muted">{row.label}</td>
                    {columns.map((c) => (
                      <td key={c.key} className="numeric py-2 pl-3 text-right">
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
    c.result.extractionRateUnknown ? "Kräver skattesats" : undefined,
  );
