"use client";

import { formatMoney, formatPercent, whenAssessable } from "@/lib/format";
import type { ScenarioResult } from "@/types";
import { AuditPanel, Card } from "../ui";

interface Row {
  label: string;
  value: (r: ScenarioResult) => string;
  emphasis?: boolean;
  audit?: (r: ScenarioResult) => ScenarioResult["purchase"]["audit"];
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

const ROWS: Row[] = [
  {
    label: "Pengar som behövs totalt",
    value: (r) => formatMoney(r.totalCapitalRequirement),
  },
  { label: "Egna pengar", value: (r) => formatMoney(r.equityCommitted) },
  { label: "Lån", value: (r) => formatMoney(r.externalDebt) },
  {
    label: "Lagfart och pantbrev",
    value: (r) => formatMoney(r.purchaseTaxesFees),
    audit: (r) => r.purchase.audit,
  },
  {
    label: "Renovering, verklig kostnad",
    value: (r) => formatMoney(r.renovationCashCost),
    audit: (r) => [...r.renovation.audit, ...r.vat.audit, ...r.rot.audit],
  },
  {
    label: "Ränta och låneavgifter",
    value: (r) => formatMoney(r.financingCost),
    audit: (r) => r.loans.audit,
  },
  {
    label: "Driftkostnader",
    value: (r) => formatMoney(r.runningCostsTotal),
    audit: (r) => r.runningCosts.audit,
  },
  {
    label: "Försäljningskostnader",
    value: (r) => formatMoney(r.saleCosts.saleCostsTotal),
    audit: (r) => r.saleCosts.audit,
  },
  { label: "Vad allt kostar", value: (r) => formatMoney(r.totalProjectCost), emphasis: true },
  { label: "Pris efter prutmån", value: exit((r) => formatMoney(r.salePrice)) },
  { label: "Vinst före skatt", value: exit((r) => formatMoney(r.profitBeforeTax)) },
  {
    label: "Skatt",
    value: afterExtraction((r) => formatMoney(r.totalTax)),
    audit: (r) => [
      ...(r.corporateTax?.audit ?? r.capitalGain.audit),
      ...(r.extraction?.audit ?? []),
      ...(r.benefit?.audit ?? []),
    ],
  },
  { label: "Vinst på affären efter skatt", value: exit((r) => formatMoney(r.profitAfterTax)), emphasis: true },
  {
    label: "Blir kvar i bolaget",
    value: exit((r) => formatMoney(r.netRetainedInCompany)),
  },
  {
    label: "Kvar till er själva",
    value: afterExtraction((r) => formatMoney(r.netAvailablePrivately)),
    emphasis: true,
  },
  {
    label: "Avkastning på egna pengar",
    value: afterExtraction((r) => formatPercent(r.roi.equityROI)),
  },
  {
    label: "Motsvarar per år",
    value: afterExtraction((r) =>
      r.roi.annualizedEquityROI === null ? "—" : formatPercent(r.roi.annualizedEquityROI),
    ),
  },
  {
    label: "Lägsta pris utan förlust",
    value: (r) => formatMoney(r.breakEven.breakEvenSalePrice),
  },
  {
    label: "Vinst när man räknar bort vad pengarna kunnat ge annars",
    value: exit((r) => formatMoney(r.profitAfterTax - r.opportunityCost.opportunityCost)),
    audit: (r) => r.opportunityCost.audit,
  },
  {
    label: "Kvar till er när allt tagits ut",
    value: afterExtraction((r) => formatMoney(r.familyNetWorth.familyNetWorthDeltaModeB)),
    emphasis: true,
    audit: (r) => r.familyNetWorth.audit,
  },
  {
    label: "Kvar till er om pengarna stannar i bolaget",
    value: exit((r) => formatMoney(r.familyNetWorth.familyNetWorthDeltaModeA)),
  },
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
            {ROWS.map((row) => (
              <tr key={row.label} className="border-b border-border/60 last:border-0">
                <td
                  className={`py-1.5 pr-3 align-top ${row.emphasis ? "font-semibold" : "text-muted"}`}
                >
                  {row.label}
                  {row.audit && results[0] && <AuditPanel trails={row.audit(results[0])} />}
                </td>
                {results.map((r) => (
                  <td
                    key={r.scenario}
                    className={`numeric py-2 pl-3 text-right align-top ${
                      row.emphasis ? "font-semibold" : ""
                    }`}
                  >
                    {row.value(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
