import type { CashFlowResult, MonthlyCashFlow } from "@/types";

export interface CashFlowParams {
  holdingPeriodMonths: number;
  purchasePrice: number;
  purchaseCosts: number;
  renovationCashCost: number;
  /** Months over which renovation spend is spread, starting at month 1. */
  renovationSpreadMonths: number;
  runningCostAnnual: number;
  rentalIncomeTotal: number;
  interestTotal: number;
  amortizationAnnual: number;
  loanDrawdown: number;
  salePrice: number;
  saleCosts: number;
  taxAtExit: number;
}

/**
 * Monthly project cash flow from month 0 (acquisition) through exit.
 *
 * The balance is built WITHOUT equity injections so that the deepest negative
 * balance is exactly the capital the owners must provide — that is the peak
 * cash requirement. Equity is then shown as an injection covering it.
 * Amortization moves cash and reduces debt but is not a project expense.
 */
export function buildCashFlow(params: CashFlowParams): CashFlowResult {
  const months: MonthlyCashFlow[] = [];
  const n = Math.max(1, Math.round(params.holdingPeriodMonths));
  const renoMonths = Math.max(1, Math.min(n, Math.round(params.renovationSpreadMonths)));
  const renoPerMonth = params.renovationCashCost / renoMonths;
  const runningPerMonth = params.runningCostAnnual / 12;
  const interestPerMonth = params.interestTotal / n;
  const amortPerMonth = params.amortizationAnnual / 12;
  const rentalPerMonth = params.rentalIncomeTotal / n;

  let balance = 0;
  let debt = 0;
  let peakDebt = 0;
  let deepestDeficit = 0;
  let monthOfMaxFundingNeed = 0;

  for (let m = 0; m <= n; m++) {
    const opening = balance;
    const isMonthZero = m === 0;
    const isExit = m === n;

    const loanDrawdown = isMonthZero ? params.loanDrawdown : 0;
    const purchaseCost = isMonthZero ? params.purchasePrice + params.purchaseCosts : 0;
    const renovationSpend = m >= 1 && m <= renoMonths ? renoPerMonth : 0;
    const runningCost = isMonthZero ? 0 : runningPerMonth;
    const interest = isMonthZero ? 0 : interestPerMonth;
    const rentalIncome = isMonthZero ? 0 : rentalPerMonth;
    const saleIncome = isExit ? params.salePrice - params.saleCosts : 0;
    const taxes = isExit ? params.taxAtExit : 0;
    const amortization = isMonthZero ? 0 : Math.min(amortPerMonth, Math.max(0, debt));

    debt += loanDrawdown - amortization;
    peakDebt = Math.max(peakDebt, debt);

    const closing =
      opening +
      loanDrawdown +
      rentalIncome +
      saleIncome -
      purchaseCost -
      renovationSpend -
      runningCost -
      interest -
      taxes -
      amortization;

    if (closing < deepestDeficit) {
      deepestDeficit = closing;
      monthOfMaxFundingNeed = m;
    }

    months.push({
      month: m,
      openingCash: opening,
      equityInjection: 0,
      loanDrawdown,
      purchaseCost,
      renovationSpend,
      runningCost,
      interest,
      rentalIncome,
      saleIncome,
      taxes,
      amortization,
      closingCash: closing,
    });

    balance = closing;
  }

  const peakCashRequirement = -deepestDeficit;

  // Show the equity injection covering the peak requirement at month 0 so the
  // timeline reads as a fully funded project.
  if (months[0] && peakCashRequirement > 0) {
    months[0].equityInjection = peakCashRequirement;
  }

  return {
    months,
    peakCashRequirement,
    peakDebt,
    equityRequired: peakCashRequirement,
    totalInterest: params.interestTotal,
    monthOfMaxFundingNeed,
  };
}
