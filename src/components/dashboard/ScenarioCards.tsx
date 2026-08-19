"use client";

import { memo } from "react";

import { formatMoney, formatPercent, whenAssessable } from "@/lib/format";
import type { OptimizationTarget, ScenarioResult } from "@/types";

/** Värdet som rangordnar scenarierna för det mål användaren valt. */
export function scoreFor(r: ScenarioResult, target: OptimizationTarget): number {
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
}

/**
 * Ett alternativ kan bara vinna på ett mått som indata faktiskt avgör. Att
 * kröna ett bolagsupplägg på "mest privat" medan skatten för att ta ut
 * pengarna är okänd vore precis den falska jämförelsen modellen ska förhindra.
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

export function bestScenarioIndex(
  results: ScenarioResult[],
  target: OptimizationTarget,
): number {
  if (results.length === 0) return -1;

  const eligible = results.map((r, i) => ({ r, i })).filter(({ r }) => metricKnown(r, target));
  if (eligible.length === 0) return -1;

  let best = eligible[0];
  for (const candidate of eligible.slice(1)) {
    if (scoreFor(candidate.r, target) > scoreFor(best.r, target)) best = candidate;
  }
  return best.i;
}

/**
 * Två bolagsalternativ kan råka ge exakt samma resultat om det ena — typiskt
 * ett nytt projektbolag — ännu inte fått några egna kostnader ifyllda. Utan
 * en förklaring på kortet ser det ut som ett fel; med en behöver ingen fråga
 * varför siffrorna är lika.
 */
function duplicateOf(results: ScenarioResult[], i: number): ScenarioResult | null {
  const r = results[i];
  if (r.corporateTax === null) return null;
  for (let j = 0; j < i; j++) {
    const other = results[j];
    if (
      other.corporateTax !== null &&
      Math.round(r.netAvailablePrivately) === Math.round(other.netAvailablePrivately) &&
      Math.round(r.netRetainedInCompany) === Math.round(other.netRetainedInCompany)
    ) {
      return other;
    }
  }
  return null;
}

function ScenarioCardsInner({
  results,
  target,
  onGoToInput,
}: {
  results: ScenarioResult[];
  target: OptimizationTarget;
  onGoToInput?: () => void;
}) {
  const best = bestScenarioIndex(results, target);

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {results.map((r, i) => {
        const isCompany = r.corporateTax !== null;
        const blocked = r.salePriceMissing || r.extractionRateUnknown;
        const placeholder = r.extractionRateUnknown
          ? "Fyll i skatten"
          : "Fyll i pris";
        const redFlags = r.riskFlags.filter((f) => f.severity === "high").length;
        const dup = blocked ? null : duplicateOf(results, i);

        return (
          <article
            key={r.scenario}
            className={`print-block p-6 ${
              i === best ? "card-accent" : "card"
            }`}
          >
            <header className="mb-5 flex items-start justify-between gap-2">
              <h3 className="text-[15px] font-semibold leading-tight">{r.label}</h3>
              {i === best && (
                <span className="shrink-0 rounded-full bg-accent-soft px-3 py-1 text-[11px] font-semibold text-accent-strong">
                  Bäst
                </span>
              )}
            </header>

            <div className="mb-5">
              <p className="text-sm text-muted">Kvar till er</p>
              <p
                className={`numeric mt-1 text-[26px] font-semibold leading-tight tracking-tight ${
                  !blocked && r.netAvailablePrivately < 0
                    ? "text-negative"
                    : i === best
                      ? "text-accent-strong"
                      : ""
                }`}
              >
                {whenAssessable(blocked, () => formatMoney(r.netAvailablePrivately), placeholder)}
              </p>
            </div>

            <dl className="space-y-2.5 text-sm">
              {isCompany && (
                <Line
                  label="Blir kvar i bolaget"
                  value={whenAssessable(r.salePriceMissing, () =>
                    formatMoney(r.netRetainedInCompany),
                  )}
                />
              )}
              <Line
                label="Avkastning på egna pengar"
                value={whenAssessable(blocked, () => formatPercent(r.roi.equityROI), placeholder)}
              />
              <Line
                label="Pengar ni måste ha"
                value={formatMoney(r.cashFlow.peakCashRequirement)}
              />
              <Line
                label="Lägsta pris utan förlust"
                value={formatMoney(r.breakEven.breakEvenSalePrice)}
              />
            </dl>

            {dup && (
              <p className="mt-5 rounded-2xl bg-surface-muted px-3.5 py-2.5 text-xs leading-relaxed text-muted">
                Ger samma resultat som {dup.label} — inga egna kostnader ifyllda än.{" "}
                {onGoToInput && (
                  <button
                    type="button"
                    onClick={onGoToInput}
                    className="font-medium text-accent-strong hover:underline"
                  >
                    Fyll i under Antaganden
                  </button>
                )}
              </p>
            )}

            {redFlags > 0 && (
              <p className="mt-3 rounded-full bg-negative-soft px-3.5 py-2 text-xs font-medium text-negative">
                {redFlags} {redFlags === 1 ? "fråga" : "frågor"} till skatterådgivaren
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="numeric font-medium">{value}</dd>
    </div>
  );
}

/**
 * Ritas bara om när siffrorna faktiskt ändrats. Under inmatning byts
 * projektet vid varje tangenttryck, men resultaten hinner ikapp först
 * efteråt — utan detta skulle hela vyn ritas om i onödan.
 */
export const ScenarioCards = memo(ScenarioCardsInner);
