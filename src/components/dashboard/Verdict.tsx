"use client";

import { formatMoney, formatPercent } from "@/lib/format";
import { OPTIMIZATION_TARGET_LABELS, type OptimizationTarget, type ScenarioResult } from "@/types";
import { Card } from "../ui";
import { metricKnown, scoreFor } from "./ScenarioCards";

/**
 * Svaret på frågan användaren faktiskt ställde, i en mening: vilken ägarform
 * som ger mest, hur mycket det blir, och hur mycket bättre än näst bästa.
 * Går det inte att svara säger kortet vad som saknas i stället för att gissa.
 */
export function Verdict({
  results,
  target,
  onGoToInput,
}: {
  results: ScenarioResult[];
  target: OptimizationTarget;
  onGoToInput?: () => void;
}) {
  const eligible = results.filter((r) => metricKnown(r, target));

  if (eligible.length === 0) {
    const missingSale = results.some((r) => r.salePriceMissing);
    const missingRate = results.some((r) => r.extractionRateUnknown);

    return (
      <Card className="border-warn/50 bg-warn-soft/40">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <h2 className="text-xl font-semibold tracking-tight">Det går inte att svara ännu</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">
              {missingSale
                ? "Fyll i vad ni tror att huset kan säljas för. Utan ett försäljningspris går det inte att säga vad projektet ger — kostnaderna och kapitalbehovet nedan stämmer redan."
                : missingRate
                  ? "Vinsten i bolaget är större än gränsbeloppet för lågbeskattad utdelning. Fyll i vilken skatt som gäller över gränsbeloppet, annars ser bolagsalternativen gratis ut att ta ut pengar från."
                  : "Några uppgifter saknas för att kunna jämföra alternativen."}
            </p>
          </div>
          {onGoToInput && (
            <button
              type="button"
              onClick={onGoToInput}
              className="rounded-lg border border-accent bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-strong"
            >
              Fyll i det som saknas
            </button>
          )}
        </div>
      </Card>
    );
  }

  const ranked = [...eligible].sort((a, b) => scoreFor(b, target) - scoreFor(a, target));
  const best = ranked[0];
  const runnerUp = ranked[1];
  const margin = runnerUp ? scoreFor(best, target) - scoreFor(runnerUp, target) : null;

  const headline =
    target === "max_equity_roi"
      ? formatPercent(best.roi.equityROI)
      : target === "min_peak_cash_required"
        ? formatMoney(best.cashFlow.peakCashRequirement)
        : target === "min_tax"
          ? formatMoney(best.totalTax)
          : formatMoney(scoreFor(best, target));

  const headlineLabel =
    target === "max_equity_roi"
      ? "avkastning på insatt kapital"
      : target === "min_peak_cash_required"
        ? "kapital som binds som mest"
        : target === "min_tax"
          ? "total skatt"
          : target === "max_company_cash"
            ? "kvar i bolaget efter skatt"
            : target === "max_private_cash"
              ? "kvar till er privat efter skatt"
              : "ökning av familjens förmögenhet";

  const positive = scoreFor(best, target) > 0 || target === "min_tax" || target === "min_peak_cash_required";

  return (
    <Card tone="accent" className="bg-accent-soft/50">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-accent">
            Bäst på {OPTIMIZATION_TARGET_LABELS[target].toLowerCase()}
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">{best.label}</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">
            {margin === null || !runnerUp ? (
              "Övriga alternativ går inte att jämföra med ännu."
            ) : Math.abs(margin) < 1000 ? (
              <>
                Lika bra som {runnerUp.label} — skillnaden är försumbar. Låt något annat avgöra,
                till exempel hur mycket kapital som binds eller hur säker skattefrågan är.
              </>
            ) : (
              <>
                Ger{" "}
                <strong className="font-semibold text-foreground">
                  {formatMoney(Math.abs(margin))}
                </strong>{" "}
                {target === "min_tax" || target === "min_peak_cash_required" ? "mindre" : "mer"} än
                näst bästa alternativet ({runnerUp.label}).
              </>
            )}{" "}
            {best.riskFlags.some((f) => f.severity === "high") &&
              "Alternativet har frågetecken som behöver stämmas av med skatterådgivare."}
          </p>
        </div>

        <div className="min-w-[200px]">
          <p className="text-sm text-muted">{headlineLabel}</p>
          <p
            className={`numeric mt-1 text-4xl font-semibold tracking-tight ${
              positive ? "" : "text-negative"
            }`}
          >
            {headline}
          </p>
        </div>
      </div>
    </Card>
  );
}
