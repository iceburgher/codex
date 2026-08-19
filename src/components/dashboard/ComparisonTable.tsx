"use client";

import { formatMoney, formatPercent, whenAssessable } from "@/lib/format";
import type { ScenarioResult } from "@/types";
import { AuditPanel, Card } from "../ui";

interface Row {
  kind: "row";
  label: string;
  value: (r: ScenarioResult) => string;
  emphasis?: boolean;
  audit?: (r: ScenarioResult) => ScenarioResult["purchase"]["audit"];
}

interface SectionHeader {
  kind: "section";
  label: string;
}

type Entry = Row | SectionHeader;

function section(label: string): SectionHeader {
  return { kind: "section", label };
}

function row(row: Omit<Row, "kind">): Row {
  return { kind: "row", ...row };
}

/** Rader som beror på exit visar hellre "kräver försäljningspris" än en påhittad förlust. */
const exit = (render: (r: ScenarioResult) => string) => (r: ScenarioResult) =>
  whenAssessable(r.salePriceMissing, () => render(r));

/** Rader som dessutom kräver att skatten för att ta ut pengarna är känd. */
const afterExtraction = (render: (r: ScenarioResult) => string) => (r: ScenarioResult) =>
  whenAssessable(
    r.salePriceMissing || r.extractionRateUnknown,
    () => render(r),
    r.extractionRateUnknown ? "Fyll i skatten" : undefined,
  );

/** Efter-projektet-raderna finns bara för bolagsägande — övriga visar ett streck. */
const postProject = (pick: (p: NonNullable<ScenarioResult["postProjectCapital"]>) => number) =>
  (r: ScenarioResult) => (r.postProjectCapital ? formatMoney(pick(r.postProjectCapital)) : "—");

const roiOrDash = (pick: (r: ScenarioResult) => number | null) => (r: ScenarioResult) => {
  const v = pick(r);
  return v === null ? "—" : formatPercent(v);
};

const ROWS: Entry[] = [
  section("Projekt"),
  row({
    label: "Köpeskilling",
    value: (r) => formatMoney(r.purchasePrice),
    audit: (r) => r.purchase.audit,
  }),
  row({
    label: "Renovering",
    value: (r) => formatMoney(r.renovationCashCost),
    audit: (r) => [...r.renovation.audit, ...r.vat.audit, ...r.rot.audit],
  }),
  row({
    label: "Lagfart och pantbrev",
    value: (r) => formatMoney(r.purchaseTaxesFees),
    audit: (r) => r.purchase.audit,
  }),
  row({
    label: "Finansieringskostnader",
    value: (r) => formatMoney(r.financingCost),
    audit: (r) => r.loans.audit,
  }),
  row({
    label: "Drift",
    value: (r) => formatMoney(r.runningCostsTotal),
    audit: (r) => r.runningCosts.audit,
  }),
  row({
    label: "Försäljningskostnader",
    value: (r) => formatMoney(r.saleCosts.saleCostsTotal),
    audit: (r) => r.saleCosts.audit,
  }),
  row({ label: "Projektkostnad totalt", value: (r) => formatMoney(r.totalProjectCost), emphasis: true }),
  row({ label: "Försäljningspris", value: exit((r) => formatMoney(r.salePrice)) }),
  row({ label: "Vinst före skatt", value: exit((r) => formatMoney(r.profitBeforeTax)) }),
  row({
    label: "Skatt på projektvinsten",
    value: afterExtraction((r) => formatMoney(r.totalTax)),
    audit: (r) => [
      ...(r.corporateTax?.audit ?? r.capitalGain.audit),
      ...(r.extraction?.audit ?? []),
      ...(r.benefit?.audit ?? []),
    ],
  }),
  row({
    label: "Vinst efter skatt",
    value: exit((r) => formatMoney(r.profitAfterTax)),
    emphasis: true,
  }),

  section("Finansiering"),
  row({
    label: "Kontantinsats som krävs",
    value: (r) => formatMoney(r.downPayment.requiredDownPayment),
    audit: (r) => r.downPayment.audit,
  }),
  row({
    label: "Bolagets/privat befintliga kapital",
    value: (r) =>
      formatMoney(
        r.corporateTax !== null
          ? r.capitalRequirementBreakdown.companyCash
          : r.capitalRequirementBreakdown.privateCash,
      ),
  }),
  row({
    label: "Ägarlån",
    value: (r) => formatMoney(r.capitalRequirementBreakdown.ownerLoan),
  }),
  row({
    label: "Aktieägartillskott",
    value: (r) => formatMoney(r.capitalRequirementBreakdown.shareholderContribution),
  }),
  row({
    label: "Externa lån",
    value: (r) =>
      formatMoney(
        r.corporateTax !== null
          ? r.capitalRequirementBreakdown.externalLoan
          : r.capitalRequirementBreakdown.privateLoan,
      ),
  }),
  row({
    label: "Annan finansiering",
    value: (r) => formatMoney(r.capitalRequirementBreakdown.otherFunding),
  }),
  row({
    label: "Max kapitalbehov",
    value: (r) => formatMoney(r.totalCapitalRequirement),
    emphasis: true,
  }),
  row({ label: "Max extern skuld", value: (r) => formatMoney(r.externalDebt) }),

  section("Efter projektet"),
  row({
    label: "Återbetalt externt lån",
    value: postProject((p) => p.externalLoanRepaid),
  }),
  row({ label: "Återbetalt ägarlån", value: postProject((p) => p.ownerLoanRepaid) }),
  row({
    label: "Kapital tillbaka till ägarna",
    value: postProject((p) => p.capitalReturnedToOwners),
  }),
  row({
    label: "Vinst kvar i bolaget",
    value: postProject((p) => p.profitRetainedInCompany),
    emphasis: true,
  }),
  row({ label: "Eventuell utdelning", value: postProject((p) => p.dividendPaid) }),
  row({ label: "Skatt på utdelning", value: postProject((p) => p.dividendTax) }),
  row({
    label: "Netto privat",
    value: postProject((p) => p.netPrivateAfterDividend),
    emphasis: true,
  }),

  section("Avkastning"),
  row({ label: "Projekt-ROI", value: exit((r) => formatPercent(r.roi.projectROI)) }),
  row({
    label: "ROI på eget kapital",
    value: afterExtraction((r) => formatPercent(r.roi.equityROI)),
  }),
  row({ label: "Bolags-ROI", value: roiOrDash((r) => r.roi.companyROI) }),
  row({ label: "ROI på ägarlån", value: roiOrDash((r) => r.roi.ownerLoanROI) }),
  row({ label: "Privat netto-ROI", value: roiOrDash((r) => r.roi.privateNetROI) }),
  row({
    label: "Motsvarar per år",
    value: afterExtraction((r) =>
      r.roi.annualizedEquityROI === null ? "—" : formatPercent(r.roi.annualizedEquityROI),
    ),
  }),
  row({
    label: "Break-even försäljningspris",
    value: (r) => formatMoney(r.breakEven.breakEvenSalePrice),
  }),
  row({
    label: "Vinst när man räknar bort vad pengarna kunnat ge annars",
    value: exit((r) => formatMoney(r.profitAfterTax - r.opportunityCost.opportunityCost)),
    audit: (r) => r.opportunityCost.audit,
  }),
  row({
    label: "Kvar till er när allt tagits ut",
    value: afterExtraction((r) => formatMoney(r.familyNetWorth.familyNetWorthDeltaModeB)),
    emphasis: true,
    audit: (r) => r.familyNetWorth.audit,
  }),
  row({
    label: "Kvar till er om pengarna stannar i bolaget",
    value: exit((r) => formatMoney(r.familyNetWorth.familyNetWorthDeltaModeA)),
  }),
];

export function ComparisonTable({ results }: { results: ScenarioResult[] }) {
  return (
    <Card
      title="Alla siffror sida vid sida"
      subtitle="Klicka på Visa uträkning under en rad för att se exakt hur talet räknats fram."
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="py-2 pr-3 font-medium text-muted">Vad vi jämför</th>
              {results.map((r) => (
                <th key={r.scenario} className="py-2 pl-3 text-right font-semibold">
                  {r.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((entry, i) =>
              entry.kind === "section" ? (
                <tr key={`section-${entry.label}-${i}`}>
                  <td
                    colSpan={results.length + 1}
                    className="pb-1.5 pt-4 text-xs font-semibold uppercase tracking-wide text-muted first:pt-1"
                  >
                    {entry.label}
                  </td>
                </tr>
              ) : (
                <tr key={entry.label} className="border-b border-border/60 last:border-0">
                  <td
                    className={`py-1.5 pr-3 align-top ${entry.emphasis ? "font-semibold" : "text-muted"}`}
                  >
                    {entry.label}
                    {entry.audit && results[0] && <AuditPanel trails={entry.audit(results[0])} />}
                  </td>
                  {results.map((r) => (
                    <td
                      key={r.scenario}
                      className={`numeric py-2 pl-3 text-right align-top ${
                        entry.emphasis ? "font-semibold" : ""
                      }`}
                    >
                      {entry.value(r)}
                    </td>
                  ))}
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
