import type { RoiResult } from "@/types";

export function calculateAnnualizedRoi(
  equityROI: number,
  holdingPeriodMonths: number,
): number | null {
  if (holdingPeriodMonths <= 0) return null;
  const base = 1 + equityROI;
  if (base <= 0) return null;
  return Math.pow(base, 12 / holdingPeriodMonths) - 1;
}

export function calculateRoi(params: {
  totalProjectCost: number;
  projectProfit: number;
  investedEquity: number;
  netProfit: number;
  holdingPeriodMonths: number;
}): RoiResult {
  const projectROI =
    params.totalProjectCost > 0 ? params.projectProfit / params.totalProjectCost : 0;
  const equityROI = params.investedEquity > 0 ? params.netProfit / params.investedEquity : 0;

  return {
    totalProjectCost: params.totalProjectCost,
    projectProfit: params.projectProfit,
    projectROI,
    investedEquity: params.investedEquity,
    netProfit: params.netProfit,
    equityROI,
    annualizedEquityROI: calculateAnnualizedRoi(equityROI, params.holdingPeriodMonths),
  };
}
