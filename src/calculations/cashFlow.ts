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
 *
 * Whatever debt remains at exit is repaid out of the sale proceeds — a real
 * buyer's bank does not let a loan ride past settlement, and the headline
 * profit figures (engine.ts) are only correct if the loan is assumed repaid
 * in full. Without this, the final month's balance would be inflated by the
 * outstanding loan, which the project never actually gets to keep.
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
    const scheduledAmortization = isMonthZero ? 0 : Math.min(amortPerMonth, Math.max(0, debt));

    debt += loanDrawdown - scheduledAmortization;
    peakDebt = Math.max(peakDebt, debt);

    // Settle the remaining balance at exit — after tracking the peak, so a
    // same-month payoff never masks how much debt the project actually ran.
    const loanRepayment = isExit ? Math.max(0, debt) : 0;
    debt -= loanRepayment;

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
      scheduledAmortization -
      loanRepayment;

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
      amortization: scheduledAmortization,
      loanRepayment,
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
