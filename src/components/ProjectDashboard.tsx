"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { calculateScenario } from "@/calculations/engine";
import { downloadFile, slugify, toCsv } from "@/lib/download";
import { formatMoney, formatPercent, whenAssessable } from "@/lib/format";
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
import { QuickFacts } from "./inputs/QuickFacts";
import { ScenarioInputsPanel } from "./inputs/ScenarioInputsPanel";
import { CashFlowChart, CostWaterfall, ScenarioBarCharts } from "./dashboard/Charts";
import { ComparisonTable } from "./dashboard/ComparisonTable";
import {
  AdvisorQuestionsPanel,
  RiskFlagsPanel,
  TopRisks,
  WarningsPanel,
} from "./dashboard/RiskPanels";
import { ScenarioCards } from "./dashboard/ScenarioCards";
import { SensitivityPanel } from "./dashboard/SensitivityPanel";
import { Verdict } from "./dashboard/Verdict";
import { Button, Card, Collapsible, SelectField, Stat, Tabs, ToggleField } from "./ui";

type TabKey = "oversikt" | "antaganden" | "detaljer";

const TABS: { value: TabKey; label: string }[] = [
  { value: "oversikt", label: "Översikt" },
  { value: "antaganden", label: "Antaganden" },
  { value: "detaljer", label: "Detaljer" },
];

export function ProjectDashboard({ projectId }: { projectId: string }) {
  const store = useProjectStore();
  const project = store.getProject(projectId);
  const [tab, setTab] = useState<TabKey>("oversikt");
  const [activeScenario, setActiveScenario] = useState<ScenarioType | null>(null);

  const results = useMemo<ScenarioResult[]>(() => {
    if (!project) return [];
    return project.compareScenarios.map((s) => calculateScenario(project, s));
  }, [project]);

  if (store.loading) {
    return <p className="p-8 text-sm text-muted">Laddar…</p>;
  }

  if (!project) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <Card title="Projektet finns inte">
          <p className="text-sm text-muted">
            Projektet har tagits bort.{" "}
            <Link href="/" className="font-medium text-accent hover:underline">
              Tillbaka till projekten
            </Link>
          </p>
        </Card>
      </div>
    );
  }

  const selectedScenario = activeScenario ?? project.selectedScenario;
  const selectedResult = results.find((r) => r.scenario === selectedScenario) ?? results[0] ?? null;
  const currentName = project.name;

  const update = (updater: (draft: PropertyProject) => void) => {
    const draft: PropertyProject = JSON.parse(JSON.stringify(project));
    updater(draft);
    store.updateProject(draft);
  };

  function exportCsv() {
    const rows: (string | number)[][] = [
      ["Nyckeltal", ...results.map((r) => r.label)],
      ["Köpeskilling", ...results.map((r) => Math.round(r.purchasePrice))],
      ["Totalt kapitalbehov", ...results.map((r) => Math.round(r.totalCapitalRequirement))],
      ["Eget kapital", ...results.map((r) => Math.round(r.equityCommitted))],
      ["Lån", ...results.map((r) => Math.round(r.externalDebt))],
      ["Skatt och avgifter vid köp", ...results.map((r) => Math.round(r.purchaseTaxesFees))],
      ["Renovering, verklig kostnad", ...results.map((r) => Math.round(r.renovationCashCost))],
      ["Finansieringskostnad", ...results.map((r) => Math.round(r.financingCost))],
      ["Driftkostnader", ...results.map((r) => Math.round(r.runningCostsTotal))],
      ["Total projektkostnad", ...results.map((r) => Math.round(r.totalProjectCost))],
      ["Försäljningspris", ...results.map((r) => Math.round(r.salePrice))],
      ["Vinst före skatt", ...results.map((r) => Math.round(r.profitBeforeTax))],
      ["Skatt", ...results.map((r) => Math.round(r.totalTax))],
      ["Vinst efter skatt", ...results.map((r) => Math.round(r.profitAfterTax))],
      ["Kvar i bolaget", ...results.map((r) => Math.round(r.netRetainedInCompany))],
      ["Kvar till er privat", ...results.map((r) => Math.round(r.netAvailablePrivately))],
      ["Avkastning på insatt kapital", ...results.map((r) => r.roi.equityROI.toFixed(4))],
      ["Årsavkastning", ...results.map((r) => (r.roi.annualizedEquityROI ?? 0).toFixed(4))],
      ["Nollpris", ...results.map((r) => Math.round(r.breakEven.breakEvenSalePrice ?? 0))],
      [
        "Förmögenhetsförändring (allt uttaget)",
        ...results.map((r) => Math.round(r.familyNetWorth.familyNetWorthDeltaModeB)),
      ],
    ];
    downloadFile(`${slugify(currentName)}-jamforelse.csv`, toCsv(rows), "text/csv");
  }

  async function exportJson() {
    const json = await store.exportProjects([projectId]);
    downloadFile(`${slugify(currentName)}.json`, json, "application/json");
  }

  return (
    <div className="mx-auto max-w-[1400px] px-5 py-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/" className="no-print text-sm font-medium text-accent hover:underline">
            ← Alla projekt
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{project.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {project.facts.address ?? "Ingen adress angiven"}
            {project.facts.municipality ? ` · ${project.facts.municipality}` : ""} · Skatteår{" "}
            {project.taxConfigSnapshot?.taxYear ?? 2026}
          </p>
        </div>
        <div className="no-print flex flex-wrap items-center gap-2">
          <span
            className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${
              store.saveState === "saved"
                ? "bg-positive-soft text-positive"
                : "bg-warn-soft text-warn"
            }`}
          >
            {store.saveState === "saved"
              ? "Sparat"
              : store.saveState === "saving"
                ? "Sparar…"
                : "Osparade ändringar"}
          </span>
          <Button size="sm" onClick={exportJson}>
            Exportera JSON
          </Button>
          <Button size="sm" onClick={exportCsv}>
            Exportera CSV
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            Skriv ut
          </Button>
        </div>
      </header>

      <div className="mb-6 max-w-md">
        <Tabs tabs={TABS} active={tab} onChange={setTab} />
      </div>

      {results.length === 0 ? (
        <Card title="Inget alternativ valt">
          <p className="text-sm text-muted">
            Välj minst en ägarform under Antaganden för att se en jämförelse.
          </p>
        </Card>
      ) : tab === "oversikt" ? (
        <div className="space-y-5">
          <QuickFacts
            project={project}
            update={update}
            onGoToRenovation={() => setTab("antaganden")}
          />

          <Verdict
            results={results}
            target={project.optimizationTarget}
            onGoToInput={() => setTab("antaganden")}
          />

          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-lg font-semibold tracking-tight">Ägarformerna sida vid sida</h2>
            <div className="no-print w-64">
              <SelectField<OptimizationTarget>
                label="Vad är viktigast för er?"
                value={project.optimizationTarget}
                options={(Object.keys(OPTIMIZATION_TARGET_LABELS) as OptimizationTarget[]).map(
                  (t) => ({ value: t, label: OPTIMIZATION_TARGET_LABELS[t] }),
                )}
                onChange={(v) => update((d) => void (d.optimizationTarget = v))}
                hint={
                  project.optimizationTarget === "min_tax"
                    ? "Lägst skatt är inte samma sak som bästa affär."
                    : undefined
                }
              />
            </div>
          </div>

          <ScenarioCards results={results} target={project.optimizationTarget} />

          <ThreeQuestions results={results} />

          <div className="grid gap-5 lg:grid-cols-2 print-stack">
            <TopRisks results={results} onShowAll={() => setTab("detaljer")} />
            <BreakEvenCard results={results} />
          </div>
        </div>
      ) : tab === "antaganden" ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight">Om objektet</h2>
            <p className="text-sm text-muted">
              Gäller alla ägarformer. Ändrar du något här räknas alla alternativ om.
            </p>
            <ObjectInputs project={project} update={update} />
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight">Om ägande och finansiering</h2>
            <p className="text-sm text-muted">
              Skiljer sig mellan ägarformerna. Välj vilken du vill justera.
            </p>

            <Card title="Ägarformer att jämföra">
              <div className="space-y-2.5">
                {ALL_SCENARIOS.map((s) => (
                  <ToggleField
                    key={s}
                    label={SCENARIO_LABELS[s]}
                    value={project.compareScenarios.includes(s)}
                    onChange={(on) =>
                      update((d) => {
                        d.compareScenarios = on
                          ? ALL_SCENARIOS.filter(
                              (x) => d.compareScenarios.includes(x) || x === s,
                            )
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

            <SelectField<ScenarioType>
              label="Ägarform att justera"
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

            <ScenarioInputsPanel
              project={project}
              scenarioType={selectedScenario}
              update={update}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <ComparisonTable results={results} />
          <ScenarioBarCharts results={results} />
          <CashFlowChart results={results} />
          {selectedResult && (
            <div className="grid gap-5 lg:grid-cols-2 print-stack">
              <CostWaterfall result={selectedResult} />
              <TaxBreakdown result={selectedResult} />
            </div>
          )}
          <SensitivityPanel project={project} scenario={selectedScenario} />
          <div className="grid gap-5 lg:grid-cols-2 print-stack">
            <RiskFlagsPanel results={results} />
            <div className="space-y-5">
              <WarningsPanel results={results} />
              <AdvisorQuestionsPanel project={project} scenarios={project.compareScenarios} />
            </div>
          </div>
          {selectedResult && (
            <Collapsible title="Kassaflöde månad för månad">
              <CashFlowTable result={selectedResult} />
            </Collapsible>
          )}
        </div>
      )}
    </div>
  );
}

/** De tre frågor som specen envisas med att inte är samma fråga. */
function ThreeQuestions({ results }: { results: ScenarioResult[] }) {
  const familyCandidates = results.filter((r) => !r.extractionRateUnknown && !r.salePriceMissing);
  const assessable = results.filter((r) => !r.salePriceMissing);

  if (assessable.length === 0) return null;

  const bestProfit = pick(assessable, (r) => r.profitAfterTax);
  const bestCompany = pick(assessable, (r) => r.netRetainedInCompany);
  const bestFamily =
    familyCandidates.length > 0
      ? pick(familyCandidates, (r) => r.familyNetWorth.familyNetWorthDeltaModeB)
      : null;

  return (
    <Card
      title="Tre frågor som inte har samma svar"
      subtitle="Störst vinst i projektet, mest kvar i bolaget och störst förmögenhet för er är olika saker."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Answer
          question="Vilket ger störst vinst i projektet?"
          answer={bestProfit.label}
          value={formatMoney(bestProfit.profitAfterTax)}
        />
        <Answer
          question="Vilket lämnar mest kapital i bolaget?"
          answer={bestCompany.netRetainedInCompany > 0 ? bestCompany.label : "Inget alternativ"}
          value={formatMoney(bestCompany.netRetainedInCompany)}
        />
        <Answer
          question="Vilket ger störst förmögenhet för er?"
          answer={bestFamily ? bestFamily.label : "Går inte att avgöra"}
          value={
            bestFamily
              ? formatMoney(bestFamily.familyNetWorth.familyNetWorthDeltaModeB)
              : "Fyll i skatt över gränsbeloppet"
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
    <div className={`rounded-xl p-4 ${headline ? "bg-accent-soft" : "bg-surface-muted"}`}>
      <p className="text-xs leading-snug text-muted">{question}</p>
      <p className="mt-2 text-[15px] font-semibold leading-tight">{answer}</p>
      <p className="numeric mt-1 text-sm text-muted">{value}</p>
      {headline && (
        <p className="mt-2 text-xs font-medium text-accent">Den vi rekommenderar att utgå från</p>
      )}
    </div>
  );
}

function pick(results: ScenarioResult[], score: (r: ScenarioResult) => number): ScenarioResult {
  return results.reduce((best, r) => (score(r) > score(best) ? r : best), results[0]);
}

/** Vad huset måste säljas för — det tal folk faktiskt vill ha. */
function BreakEvenCard({ results }: { results: ScenarioResult[] }) {
  return (
    <Card
      title="Vad måste huset säljas för?"
      subtitle="Nollpriset är där projektet varken går plus eller minus efter skatt och alla kostnader."
    >
      <div className="space-y-3">
        {results.map((r) => (
          <div key={r.scenario} className="flex items-baseline justify-between gap-4">
            <span className="text-sm">{r.label}</span>
            <span className="flex items-baseline gap-4">
              <span className="numeric text-sm font-semibold">
                {formatMoney(r.breakEven.breakEvenSalePrice)}
              </span>
              <span className="numeric hidden text-xs text-muted sm:inline">
                {formatMoney(r.breakEven.salePriceFor20PctROI)} för 20 %
              </span>
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function TaxBreakdown({ result }: { result: ScenarioResult }) {
  const rows: [string, number][] = result.corporateTax
    ? [
        ["Bolagsskatt", result.corporateTax.companyTax],
        ["Skatt när pengarna tas ut", result.extraction?.ownerExtractionTax ?? 0],
        ["Förmånsskatt för ägarna", result.benefit?.ownerBenefitTax ?? 0],
        [
          "Arbetsgivaravgift på förmån",
          result.benefit?.companyEmployerContributionOnBenefit ?? 0,
        ],
      ]
    : [
        ["Kapitalvinstskatt", result.capitalGain.capitalGainTax],
        ["Skatt på hyresintäkter", result.rental.privateRentalTax],
        ["Utdelningsskatt för att finansiera köpet", result.dividend?.dividendTax ?? 0],
        [
          "Skatt och avgifter på lön",
          result.salary ? result.salary.companyCashCost - result.salary.grossSalary : 0,
        ],
      ];

  const total = rows.reduce((s, [, v]) => s + v, 0);

  return (
    <Card title="Skatter och avgifter" subtitle={result.label}>
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label} className="border-b border-border last:border-0">
              <td className="py-2 pr-3 text-muted">{label}</td>
              <td className="numeric py-2 text-right">{formatMoney(value)}</td>
            </tr>
          ))}
          <tr className="border-t border-border-strong font-semibold">
            <td className="py-2">Totalt</td>
            <td className="numeric py-2 text-right">{formatMoney(total)}</td>
          </tr>
        </tbody>
      </table>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <Stat
          label="Andel av vinsten före skatt"
          value={whenAssessable(
            result.salePriceMissing || result.profitBeforeTax <= 0,
            () => formatPercent(result.totalTax / result.profitBeforeTax),
            "—",
          )}
        />
        <Stat
          label="Mest lån samtidigt"
          value={formatMoney(result.cashFlow.peakDebt)}
          hint={`Störst kapitalbehov månad ${result.cashFlow.monthOfMaxFundingNeed}`}
        />
      </div>
    </Card>
  );
}

function CashFlowTable({ result }: { result: ScenarioResult }) {
  return (
    <div>
      <p className="mb-3 text-sm text-muted">
        {result.label}. Amortering minskar skulden men är ingen kostnad för projektet.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-xs">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="py-2 pr-2">Månad</th>
              <th className="py-2 pr-2 text-right">Ingående</th>
              <th className="py-2 pr-2 text-right">Lån</th>
              <th className="py-2 pr-2 text-right">Köp</th>
              <th className="py-2 pr-2 text-right">Renovering</th>
              <th className="py-2 pr-2 text-right">Drift</th>
              <th className="py-2 pr-2 text-right">Ränta</th>
              <th className="py-2 pr-2 text-right">Hyra</th>
              <th className="py-2 pr-2 text-right">Försäljning</th>
              <th className="py-2 pr-2 text-right">Skatt</th>
              <th className="py-2 pr-2 text-right">Amortering</th>
              <th className="py-2 text-right">Utgående</th>
            </tr>
          </thead>
          <tbody>
            {result.cashFlow.months.map((m) => (
              <tr key={m.month} className="border-b border-border/60 last:border-0">
                <td className="py-1.5 pr-2">{m.month}</td>
                <td className="numeric py-1.5 pr-2 text-right">{formatMoney(m.openingCash)}</td>
                <td className="numeric py-1.5 pr-2 text-right">{formatMoney(m.loanDrawdown)}</td>
                <td className="numeric py-1.5 pr-2 text-right">{formatMoney(-m.purchaseCost)}</td>
                <td className="numeric py-1.5 pr-2 text-right">
                  {formatMoney(-m.renovationSpend)}
                </td>
                <td className="numeric py-1.5 pr-2 text-right">{formatMoney(-m.runningCost)}</td>
                <td className="numeric py-1.5 pr-2 text-right">{formatMoney(-m.interest)}</td>
                <td className="numeric py-1.5 pr-2 text-right">{formatMoney(m.rentalIncome)}</td>
                <td className="numeric py-1.5 pr-2 text-right">{formatMoney(m.saleIncome)}</td>
                <td className="numeric py-1.5 pr-2 text-right">{formatMoney(-m.taxes)}</td>
                <td className="numeric py-1.5 pr-2 text-right">{formatMoney(-m.amortization)}</td>
                <td
                  className={`numeric py-1.5 text-right font-medium ${
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
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Kapital som binds" value={formatMoney(result.cashFlow.peakCashRequirement)} />
        <Stat label="Mest lån samtidigt" value={formatMoney(result.cashFlow.peakDebt)} />
        <Stat label="Eget kapital som krävs" value={formatMoney(result.cashFlow.equityRequired)} />
        <Stat label="Total ränta" value={formatMoney(result.cashFlow.totalInterest)} />
      </div>
    </div>
  );
}
