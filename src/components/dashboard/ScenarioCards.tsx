"use client";

import { formatMoney, formatPercent, whenAssessable } from "@/lib/format";
import type { OptimizationTarget, ScenarioResult } from "@/types";

/**
 * A scenario can only win on a metric the inputs actually determine. Ranking a
 * company structure top on private cash while the extraction tax rate is
 * unknown would be exactly the false comparison the model is meant to prevent.
 */
export function metricKnown(r: ScenarioResult, target: OptimizationTarget): boolean {
  if (target === "min_peak_cash_required") return true;
  if (r.salePriceMissing) return false;
  if (
    r.extractionRateUnknown &&
    (target === "max_private_cash" || target === "max_family_net_worth" || target === "min_tax")
  ) {
    return false;
  }
  return true;
}

/** Ranks scenarios by the currently selected optimization target. */
export function bestScenarioIndex(
  results: ScenarioResult[],
  target: OptimizationTarget,
): number {
  if (results.length === 0) return -1;

  const eligible = results
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => metricKnown(r, target));
  if (eligible.length === 0) return -1;

  const score = (r: ScenarioResult): number => {
    switch (target) {
      case "max_private_cash":
        return r.netAvailablePrivately;
      case "max_company_cash":
        return r.netRetainedInCompany;
      case "max_equity_roi":
        return r.roi.equityROI;
      case "min_peak_cash_required":
        return -r.cashFlow.peakCashRequirement;
      case "min_tax":
        return -r.totalTax;
      default:
        return r.familyNetWorth.familyNetWorthDeltaModeB;
    }
  };

  let best = eligible[0];
  for (const candidate of eligible.slice(1)) {
    if (score(candidate.r) > score(best.r)) best = candidate;
  }
  return best.i;
}

export function ScenarioCards({
  results,
  target,
}: {
  results: ScenarioResult[];
  target: OptimizationTarget;
}) {
  const best = bestScenarioIndex(results, target);

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {results.map((r, i) => {
        const isCompany = r.corporateTax !== null;
        return (
          <article
            key={r.scenario}
            className={`rounded-lg border bg-surface p-4 print-block ${
              i === best ? "border-accent ring-1 ring-accent" : "border-border"
            }`}
          >
            <header className="mb-3 flex items-start justify-between gap-2">
              <h3 className="text-xs font-semibold leading-tight">{r.label}</h3>
              {i === best && (
                <span className="shrink-0 rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                  Best
                </span>
              )}
            </header>

            <dl className="space-y-1.5 text-xs">
              <Line
                label={isCompany ? "Profit after corporate tax" : "Net profit"}
                value={whenAssessable(r.salePriceMissing, () => formatMoney(r.profitAfterTax))}
                tone={r.salePriceMissing ? undefined : r.profitAfterTax < 0 ? "negative" : "positive"}
                emphasis
              />
              <Line
                label={isCompany ? "Net if extracted privately" : "Net profit to owners"}
                value={whenAssessable(
                  r.salePriceMissing || r.extractionRateUnknown,
                  () => formatMoney(r.netAvailablePrivately),
                  r.extractionRateUnknown ? "Needs dividend tax rate" : undefined,
                )}
                tone={
                  !r.salePriceMissing && !r.extractionRateUnknown && r.netAvailablePrivately < 0
                    ? "negative"
                    : undefined
                }
              />
              <Line
                label="Equity ROI"
                value={whenAssessable(r.salePriceMissing, () => formatPercent(r.roi.equityROI))}
              />
              <Line
                label="Annualized ROI"
                value={whenAssessable(r.salePriceMissing, () =>
                  r.roi.annualizedEquityROI === null
                    ? "n/a"
                    : formatPercent(r.roi.annualizedEquityROI),
                )}
              />
              <Line label="Peak cash required" value={formatMoney(r.cashFlow.peakCashRequirement)} />
              <Line
                label="Break-even sale price"
                value={formatMoney(r.breakEven.breakEvenSalePrice)}
              />
              <Line
                label="Family net worth delta"
                value={whenAssessable(
                  r.salePriceMissing || r.extractionRateUnknown,
                  () => formatMoney(r.familyNetWorth.familyNetWorthDeltaModeB),
                  r.extractionRateUnknown ? "Needs dividend tax rate" : undefined,
                )}
                tone={
                  r.salePriceMissing || r.extractionRateUnknown
                    ? undefined
                    : r.familyNetWorth.familyNetWorthDeltaModeB < 0
                      ? "negative"
                      : "positive"
                }
                emphasis
              />
            </dl>

            {r.extractionRateUnknown && (
              <p className="mt-2 rounded bg-warn-soft px-2 py-1 text-[10px] text-warn">
                Profit exceeds the low-tax dividend allowance. Supply the tax rate above the
                allowance before comparing private outcomes.
              </p>
            )}

            {r.riskFlags.some((f) => f.severity === "high") && (
              <p className="mt-3 rounded bg-danger-soft px-2 py-1 text-[10px] font-medium text-negative">
                {r.riskFlags.filter((f) => f.severity === "high").length} red flag(s) — obtain tax
                advice
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}

function Line({
  label,
  value,
  tone,
  emphasis,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
  emphasis?: boolean;
}) {
  const toneClass =
    tone === "negative" ? "text-negative" : tone === "positive" ? "text-positive" : "";
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-muted">{label}</dt>
      <dd className={`numeric ${emphasis ? "font-semibold" : ""} ${toneClass}`}>{value}</dd>
    </div>
  );
}
