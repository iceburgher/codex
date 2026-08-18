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

/** Exit-dependent rows read as "needs sale price" rather than as a computed loss. */
const exit = (render: (r: ScenarioResult) => string) => (r: ScenarioResult) =>
  whenAssessable(r.salePriceMissing, () => render(r));

/** Rows that also depend on the owner-level extraction tax being known. */
const afterExtraction = (render: (r: ScenarioResult) => string) => (r: ScenarioResult) =>
  whenAssessable(
    r.salePriceMissing || r.extractionRateUnknown,
    () => render(r),
    r.extractionRateUnknown ? "Needs dividend tax rate" : undefined,
  );

const ROWS: Row[] = [
  {
    label: "Total capital requirement",
    value: (r) => formatMoney(r.totalCapitalRequirement),
  },
  { label: "Equity committed", value: (r) => formatMoney(r.equityCommitted) },
  { label: "External debt", value: (r) => formatMoney(r.externalDebt) },
  {
    label: "Purchase taxes / fees",
    value: (r) => formatMoney(r.purchaseTaxesFees),
    audit: (r) => r.purchase.audit,
  },
  {
    label: "Renovation cash cost",
    value: (r) => formatMoney(r.renovationCashCost),
    audit: (r) => [...r.renovation.audit, ...r.vat.audit, ...r.rot.audit],
  },
  { label: "Financing cost", value: (r) => formatMoney(r.financingCost), audit: (r) => r.loans.audit },
  {
    label: "Running costs",
    value: (r) => formatMoney(r.runningCostsTotal),
    audit: (r) => r.runningCosts.audit,
  },
  {
    label: "Sale costs",
    value: (r) => formatMoney(r.saleCosts.saleCostsTotal),
    audit: (r) => r.saleCosts.audit,
  },
  { label: "Total project cost", value: (r) => formatMoney(r.totalProjectCost), emphasis: true },
  { label: "Sale price (after buffer)", value: exit((r) => formatMoney(r.salePrice)) },
  { label: "Profit before tax", value: exit((r) => formatMoney(r.profitBeforeTax)) },
  {
    label: "Tax",
    value: afterExtraction((r) => formatMoney(r.totalTax)),
    audit: (r) => [
      ...(r.corporateTax?.audit ?? r.capitalGain.audit),
      ...(r.extraction?.audit ?? []),
      ...(r.benefit?.audit ?? []),
    ],
  },
  { label: "Profit after tax", value: exit((r) => formatMoney(r.profitAfterTax)), emphasis: true },
  {
    label: "Net retained in company",
    value: exit((r) => formatMoney(r.netRetainedInCompany)),
  },
  {
    label: "Net available privately",
    value: afterExtraction((r) => formatMoney(r.netAvailablePrivately)),
    emphasis: true,
  },
  { label: "Equity ROI", value: afterExtraction((r) => formatPercent(r.roi.equityROI)) },
  {
    label: "Annualized equity ROI",
    value: afterExtraction((r) =>
      r.roi.annualizedEquityROI === null ? "n/a" : formatPercent(r.roi.annualizedEquityROI),
    ),
  },
  {
    label: "Break-even sale price",
    value: (r) => formatMoney(r.breakEven.breakEvenSalePrice),
  },
  {
    label: "Economic profit after opportunity cost",
    value: exit((r) => formatMoney(r.profitAfterTax - r.opportunityCost.opportunityCost)),
    audit: (r) => r.opportunityCost.audit,
  },
  {
    label: "Family net worth delta (Mode B)",
    value: afterExtraction((r) => formatMoney(r.familyNetWorth.familyNetWorthDeltaModeB)),
    emphasis: true,
    audit: (r) => r.familyNetWorth.audit,
  },
  {
    label: "Family net worth delta (Mode A)",
    value: exit((r) => formatMoney(r.familyNetWorth.familyNetWorthDeltaModeA)),
  },
];

export function ComparisonTable({ results }: { results: ScenarioResult[] }) {
  return (
    <Card
      title="Scenario comparison"
      subtitle="Same object facts, different ownership and financing structures."
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-xs">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="py-2 pr-3 font-medium text-muted">KPI</th>
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
                    className={`numeric py-1.5 pl-3 text-right align-top ${
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
