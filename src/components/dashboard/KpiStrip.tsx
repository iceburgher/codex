"use client";

import { formatMoney, formatPercent, whenAssessable } from "@/lib/format";
import type { ScenarioResult } from "@/types";
import { MiniBars, Sparkline } from "./MiniViz";

/**
 * Fyra tal högst upp: vad det kostar, vad som binds, vad som blir kvar och
 * hur stor marginalen till nollpriset är. Det sista kortet är framhävt, som
 * aktivitetskortet i förlagan.
 */
export function KpiStrip({
  result,
  expectedSalePrice,
}: {
  result: ScenarioResult;
  expectedSalePrice: number | null;
}) {
  const cashCurve = result.cashFlow.months.map((m) => -m.closingCash);
  const costBars = [
    result.purchaseTaxesFees,
    result.renovationCashCost,
    result.financingCost,
    result.runningCostsTotal,
    result.saleCosts.saleCostsTotal,
  ];

  const breakEven = result.breakEven.breakEvenSalePrice;
  const margin =
    breakEven !== null && expectedSalePrice !== null && expectedSalePrice > 0
      ? (expectedSalePrice - breakEven) / expectedSalePrice
      : null;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Tile
        label="Projektet kostar"
        value={formatMoney(result.totalProjectCost)}
        viz={<MiniBars values={costBars} className="h-8 w-20" />}
      />
      <Tile
        label="Kapital som binds"
        value={formatMoney(result.cashFlow.peakCashRequirement)}
        viz={<Sparkline values={cashCurve} className="h-8 w-20" fill />}
      />
      <Tile
        label="Kvar till er"
        value={whenAssessable(
          result.salePriceMissing || result.extractionRateUnknown,
          () => formatMoney(result.netAvailablePrivately),
          result.extractionRateUnknown ? "Kräver skattesats" : "Kräver pris",
        )}
        viz={
          <Sparkline
            values={result.cashFlow.months.map((m) => m.closingCash)}
            className="h-8 w-20"
            fill
          />
        }
      />
      <Tile
        accent
        label="Marginal till nollpris"
        value={margin === null ? "Kräver pris" : formatPercent(margin)}
        hint={breakEven === null ? undefined : `Nollpris ${formatMoney(breakEven)}`}
        viz={
          <Sparkline
            values={cashCurve.slice().reverse()}
            className="h-8 w-20"
          />
        }
      />
    </div>
  );
}

function Tile({
  label,
  value,
  viz,
  hint,
  accent = false,
}: {
  label: string;
  value: string;
  viz: React.ReactNode;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className={`${accent ? "card-accent" : "card"} flex items-center gap-4 p-5 print-block`}>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted">{label}</p>
        <p
          className={`numeric mt-1 truncate text-xl font-semibold tracking-tight ${
            accent ? "text-accent-strong" : ""
          }`}
        >
          {value}
        </p>
        {hint && <p className="numeric mt-0.5 truncate text-xs text-muted">{hint}</p>}
      </div>
      <div className="shrink-0">{viz}</div>
    </div>
  );
}
