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
  /** Vinst efter bolagsskatt / bolagets + ägarnas bundna kapital. Bara bolagsägande. */
  companyProfitAfterTax?: number;
  companyBoundCapital?: number;
  /** Vinst efter bolagsskatt / ägarlånet — inte prorata. */
  ownerLoanAmount?: number;
  /** Privat nettovinst efter ev. utdelningsskatt / kapital som faktiskt satsats privat. */
  privateNetProfit?: number;
  privateCapitalPutIn?: number;
}): RoiResult {
  const projectROI =
    params.totalProjectCost > 0 ? params.projectProfit / params.totalProjectCost : 0;
  const equityROI = params.investedEquity > 0 ? params.netProfit / params.investedEquity : 0;

  const companyROI =
    params.companyProfitAfterTax !== undefined &&
    params.companyBoundCapital !== undefined &&
    params.companyBoundCapital > 0
      ? params.companyProfitAfterTax / params.companyBoundCapital
      : null;

  const ownerLoanROI =
    params.companyProfitAfterTax !== undefined &&
    params.ownerLoanAmount !== undefined &&
    params.ownerLoanAmount > 0
      ? params.companyProfitAfterTax / params.ownerLoanAmount
      : null;

  const privateNetROI =
    params.privateNetProfit !== undefined &&
    params.privateCapitalPutIn !== undefined &&
    params.privateCapitalPutIn > 0
      ? params.privateNetProfit / params.privateCapitalPutIn
      : null;

  return {
    totalProjectCost: params.totalProjectCost,
    projectProfit: params.projectProfit,
    projectROI,
    investedEquity: params.investedEquity,
    netProfit: params.netProfit,
    equityROI,
    annualizedEquityROI: calculateAnnualizedRoi(equityROI, params.holdingPeriodMonths),
    companyROI,
    ownerLoanROI,
    privateNetROI,
  };
}
