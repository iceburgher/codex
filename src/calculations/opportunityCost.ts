import type { CashFlowResult, OpportunityCostResult } from "@/types";

/**
 * Average capital tied up, derived from the monthly cash flow when available
 * (mean of the negative balances) rather than a flat "peak x rate" shortcut.
 */
export function calculateOpportunityCost(params: {
  cashFlow: CashFlowResult;
  annualAlternativeReturnRate: number;
  holdingPeriodMonths: number;
}): OpportunityCostResult {
  const deficits = params.cashFlow.months.map((m) => Math.max(0, -m.closingCash));
  const averageEquityCapitalTiedUp =
    deficits.length > 0 ? deficits.reduce((a, b) => a + b, 0) / deficits.length : 0;

  const opportunityCost =
    averageEquityCapitalTiedUp *
    (params.annualAlternativeReturnRate || 0) *
    (params.holdingPeriodMonths / 12);

  return {
    averageEquityCapitalTiedUp,
    opportunityCost,
    audit: [
      {
        title: "Alternativkostnad för bundet kapital",
        source: "ESTIMATE",
        lines: [
          { label: "Genomsnittligt bundet kapital", value: averageEquityCapitalTiedUp },
          {
            label: "Alternativ avkastning",
            value: `${((params.annualAlternativeReturnRate || 0) * 100).toFixed(1).replace(".", ",")} % per år`,
          },
          { label: "Innehavstid", value: `${params.holdingPeriodMonths} mån` },
          { label: "Alternativkostnad", value: opportunityCost },
        ],
      },
    ],
  };
}
