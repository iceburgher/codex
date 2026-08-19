"use client";

import Link from "next/link";
import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { calculateScenario } from "@/calculations/engine";
import { downloadFile, slugify, toCsv } from "@/lib/download";
import { formatMoney, formatPercent, whenAssessable } from "@/lib/format";
import { useProjectStore } from "@/lib/store";
import {
  SCENARIO_LABELS,
  type OptimizationTarget,
  type PropertyProject,
  type ScenarioResult,
  type ScenarioType,
} from "@/types";
import { ALL_SCENARIOS } from "@/lib/defaults";
import { ObjectInputs } from "./inputs/ObjectInputs";
import { ProspectImport } from "./inputs/ProspectImport";
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
import { KpiStrip } from "./dashboard/KpiStrip";
import { ScenarioCards } from "./dashboard/ScenarioCards";
import { SensitivityPanel } from "./dashboard/SensitivityPanel";
import { HeadToHead } from "./dashboard/HeadToHead";
import { AiAssistant } from "./dashboard/AiAssistant";
import { Button, Card, Collapsible, SelectField, Stat, Tabs, ToggleField } from "./ui";

type TabKey = "oversikt" | "antaganden" | "detaljer";

/**
 * Frågan är alltid densamma: vad blir kvar till ägarna efter skatt när huset
 * är sålt och pengarna tagits ut. Därför finns inget mål att välja mellan.
 */
const HEADLINE_TARGET: OptimizationTarget = "max_family_net_worth";

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

  /*
   * Varje beräkning kör lösaren för nollpris och avkastningsmål, vilket
   * betyder hundratals varv genom motorn. Görs det synkront vid varje
   * tangenttryck hackar inmatningen. Med ett uppskjutet värde ritas fälten
   * direkt och siffrorna hinner ikapp strax efter.
   */
  const deferredProject = useDeferredValue(project);
  const results = useMemo<ScenarioResult[]>(() => {
    if (!deferredProject) return [];
    return deferredProject.compareScenarios.map((s) => calculateScenario(deferredProject, s));
  }, [deferredProject]);

  const recalculating = project !== deferredProject;

  // Memoiserade barn ritas bara om när deras egna värden ändras — men bara
  // om funktionerna de får behåller sin identitet mellan omritningarna.
  // Hookarna måste ligga före de tidiga returerna nedan.
  const goToAssumptions = useCallback(() => setTab("antaganden"), []);
  const goToDetails = useCallback(() => setTab("detaljer"), []);
  const setExtractionRate = useCallback(
    (rate: number) => {
      if (!project) return;
      const draft: PropertyProject = JSON.parse(JSON.stringify(project));
      draft.scenarios.EXISTING_COMPANY.dividend.dividendTaxAboveAllowance = rate;
      store.updateProject(draft);
    },
    [project, store],
  );

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
      ["Vad vi jämför", ...results.map((r) => r.label)],
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
    <div>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/" className="no-print text-sm font-medium text-accent-strong hover:underline">
            ← Alla projekt
          </Link>
          <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-tight">
            {project.name}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {project.facts.address ?? "Ingen adress angiven"}
            {project.facts.municipality ? ` · ${project.facts.municipality}` : ""} · Skatteår{" "}
            {project.taxConfigSnapshot?.taxYear ?? 2026}
          </p>
        </div>
        <div className="no-print flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-3.5 py-2 text-xs font-medium ${
              recalculating
                ? "bg-surface-muted text-muted"
                : store.saveState === "saved"
                  ? "bg-positive-soft text-positive"
                  : "bg-warn-soft text-warn"
            }`}
          >
            {recalculating
              ? "Räknar…"
              : store.saveState === "saved"
                ? "Sparat"
                : store.saveState === "saving"
                  ? "Sparar…"
                  : "Osparade ändringar"}
          </span>
          <Button size="sm" onClick={exportJson}>
            JSON
          </Button>
          <Button size="sm" onClick={exportCsv}>
            CSV
          </Button>
          <Button size="sm" variant="dark" onClick={() => window.print()}>
            Skriv ut
          </Button>
        </div>
      </header>

      <div className="mb-6">
        <Tabs tabs={TABS} active={tab} onChange={setTab} />
      </div>

      <div className="mb-6">
        <AiAssistant project={project} update={update} />
      </div>

      {results.length === 0 ? (
        <Card title="Inget alternativ valt">
          <p className="text-sm text-muted">
            Slå på minst ett sätt att äga huset under Antaganden.
          </p>
        </Card>
      ) : tab === "oversikt" ? (
        <div className="space-y-5">
          {selectedResult && (
            <KpiStrip
              result={selectedResult}
              expectedSalePrice={project.inputs.expectedSalePrice}
            />
          )}

          <QuickFacts
            project={project}
            update={update}
            onGoToRenovation={goToAssumptions}
            capitalNeeded={selectedResult?.totalCapitalRequirement}
          />

          <HeadToHead
            results={results}
            onGoToInput={goToAssumptions}
            onSetExtractionRate={setExtractionRate}
          />

          <div>
            <h2 className="text-lg font-semibold tracking-tight">Alternativen i detalj</h2>
            <p className="mt-1 text-sm text-muted">
              Här är varje alternativ för sig. Vill ni jämföra fler sätt att äga huset slår ni
              på dem under Antaganden.
            </p>
          </div>

          <ScenarioCards results={results} target={HEADLINE_TARGET} />

          <ThreeQuestions results={results} />

          <div className="grid gap-5 lg:grid-cols-2 print-stack">
            <TopRisks results={results} onShowAll={goToDetails} />
            <BreakEvenCard results={results} />
          </div>
        </div>
      ) : tab === "antaganden" ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight">Om huset</h2>
            <p className="text-sm text-muted">
              Gäller alla alternativ. Ändrar du något här räknas allt om.
            </p>
            <ProspectImport update={update} />
            <ObjectInputs project={project} update={update} />
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight">Ägande och lån</h2>
            <p className="text-sm text-muted">
              Det här skiljer sig mellan alternativen. Välj vilket du vill ändra.
            </p>

            <Card title="Sätt att äga huset">
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
              label="Vilket alternativ vill du ändra?"
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
            <Collapsible title="Pengarna månad för månad">
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
      title="Tre olika frågor — tre olika svar"
      subtitle="Att affären går bra är inte samma sak som att ni får pengarna i handen."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Answer
          question="Var tjänar själva affären mest?"
          answer={bestProfit.label}
          value={formatMoney(bestProfit.profitAfterTax)}
        />
        <Answer
          question="Var blir det mest kvar i bolaget?"
          answer={bestCompany.netRetainedInCompany > 0 ? bestCompany.label : "Inget alternativ"}
          value={formatMoney(bestCompany.netRetainedInCompany)}
        />
        <Answer
          question="Var får ni mest pengar själva?"
          answer={bestFamily ? bestFamily.label : "Går inte att svara på"}
          value={
            bestFamily
              ? formatMoney(bestFamily.familyNetWorth.familyNetWorthDeltaModeB)
              : "Fyll i skatten på uttaget"
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
        <p className="mt-2 text-xs font-medium text-accent-strong">Det är den här som räknas</p>
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
      title="Vad måste ni få för huset?"
      subtitle="Under det här priset förlorar ni pengar, när allt är betalt och skattat."
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
                {formatMoney(r.breakEven.salePriceFor20PctROI)} för 20 % avkastning
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
        ["Skatt när ni tar ut pengarna", result.extraction?.ownerExtractionTax ?? 0],
        ["Skatt för att ni kan använda huset", result.benefit?.ownerBenefitTax ?? 0],
        [
          "Bolagets avgift för samma sak",
          result.benefit?.companyEmployerContributionOnBenefit ?? 0,
        ],
      ]
    : [
        ["Skatt på vinsten vid försäljning", result.capitalGain.capitalGainTax],
        ["Skatt på hyran", result.rental.privateRentalTax],
        ["Skatt för att få ut pengar till köpet", result.dividend?.dividendTax ?? 0],
        [
          "Skatt och avgifter om ni tar ut lön",
          result.salary ? result.salary.companyCashCost - result.salary.grossSalary : 0,
        ],
      ];

  const total = rows.reduce((s, [, v]) => s + v, 0);

  return (
    <Card title="Vad ni betalar i skatt" subtitle={result.label}>
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
          label="Så stor del av vinsten går till skatt"
          value={whenAssessable(
            result.salePriceMissing || result.profitBeforeTax <= 0,
            () => formatPercent(result.totalTax / result.profitBeforeTax),
            "—",
          )}
        />
        <Stat
          label="Största skulden under tiden"
          value={formatMoney(result.cashFlow.peakDebt)}
          hint={`Tuffast månad: ${result.cashFlow.monthOfMaxFundingNeed}`}
        />
      </div>
    </Card>
  );
}

function CashFlowTable({ result }: { result: ScenarioResult }) {
  return (
    <div>
      <p className="mb-3 text-sm text-muted">
        {result.label}. Amortering är inte en kostnad — pengarna går till att minska skulden.
        Kvarvarande lån löses ur försäljningslikviden den sista månaden.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-xs">
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
              <th className="py-2 pr-2 text-right">Lån löst</th>
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
                <td className="numeric py-1.5 pr-2 text-right">{formatMoney(-m.loanRepayment)}</td>
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
        <Stat label="Pengar ni måste ha" value={formatMoney(result.cashFlow.peakCashRequirement)} />
        <Stat label="Största skulden" value={formatMoney(result.cashFlow.peakDebt)} />
        <Stat label="Egna pengar som krävs" value={formatMoney(result.cashFlow.equityRequired)} />
        <Stat label="Ränta totalt" value={formatMoney(result.cashFlow.totalInterest)} />
      </div>
    </div>
  );
}
