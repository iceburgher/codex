import { describe, expect, it } from "vitest";
import { calculateAnnualizedRoi, calculateRoi } from "@/calculations/roi";
import { solveSalePrice } from "@/calculations/breakEven";
import { calculateFamilyNetWorth } from "@/calculations/netWorth";
import { buildCashFlow } from "@/calculations/cashFlow";
import { calculateOpportunityCost } from "@/calculations/opportunityCost";

describe("ROI", () => {
  it("annualizes a 12-month return unchanged", () => {
    expect(calculateAnnualizedRoi(0.2, 12)).toBeCloseTo(0.2, 10);
  });

  it("annualizes a 6-month return upward", () => {
    expect(calculateAnnualizedRoi(0.2, 6)).toBeCloseTo(0.44, 10);
  });

  it("returns null when the equity is more than wiped out", () => {
    expect(calculateAnnualizedRoi(-1.5, 12)).toBeNull();
    expect(calculateAnnualizedRoi(-1, 12)).toBeNull();
  });

  it("returns null for a zero holding period", () => {
    expect(calculateAnnualizedRoi(0.2, 0)).toBeNull();
  });

  it("computes project and equity ROI", () => {
    const r = calculateRoi({
      totalProjectCost: 5_000_000,
      projectProfit: 500_000,
      investedEquity: 2_000_000,
      netProfit: 400_000,
      holdingPeriodMonths: 12,
    });
    expect(r.projectROI).toBeCloseTo(0.1, 10);
    expect(r.equityROI).toBeCloseTo(0.2, 10);
  });

  it("does not divide by zero equity", () => {
    const r = calculateRoi({
      totalProjectCost: 0,
      projectProfit: 0,
      investedEquity: 0,
      netProfit: 100,
      holdingPeriodMonths: 12,
    });
    expect(r.equityROI).toBe(0);
    expect(r.projectROI).toBe(0);
  });
});

describe("break-even solver", () => {
  it("finds the sale price where a linear profit function crosses zero", () => {
    const profit = (sp: number) => sp - 5_000_000;
    const r = solveSalePrice(profit, 0, { upperBound: 20_000_000 });
    expect(r.salePrice).toBeCloseTo(5_000_000, -3);
    expect(r.converged).toBe(true);
  });

  it("handles a piecewise function where tax kicks in above the basis", () => {
    // Below basis: no tax. Above: 22% on the gain.
    const basis = 4_500_000;
    const profit = (sp: number) => {
      const gain = sp - basis;
      const tax = gain > 0 ? gain * 0.22 : 0;
      return sp - basis - 500_000 - tax;
    };
    const r = solveSalePrice(profit, 0, { upperBound: 20_000_000 });
    expect(r.salePrice).not.toBeNull();
    expect(profit(r.salePrice as number)).toBeCloseTo(0, -2);
  });

  it("reports no solution when the target is unreachable", () => {
    const r = solveSalePrice(() => -1_000_000, 0, { upperBound: 20_000_000 });
    expect(r.salePrice).toBeNull();
  });

  it("respects the SEK 100 tolerance", () => {
    const r = solveSalePrice((sp) => sp - 3_333_333, 0, { upperBound: 20_000_000, tolerance: 100 });
    expect(Math.abs((r.salePrice as number) - 3_333_333)).toBeLessThanOrEqual(100);
  });
});

describe("family net worth", () => {
  it("charges the deferred owner tax only in the fully extracted mode", () => {
    const r = calculateFamilyNetWorth({
      privateCashAfterProject: 0,
      companyValueAfterProject: 3_000_000,
      deferredOwnerTaxToExtract: 400_000,
      privateCapitalConsumed: 0,
      companyCapitalConsumed: 2_000_000,
      remainingPrivateDebt: 0,
      remainingCompanyDebt: 0,
    });
    expect(r.familyNetWorthDeltaModeA).toBe(1_000_000);
    expect(r.familyNetWorthDeltaModeB).toBe(600_000);
  });

  it("does not treat company-retained value as private cash", () => {
    const company = calculateFamilyNetWorth({
      privateCashAfterProject: 0,
      companyValueAfterProject: 1_500_000,
      deferredOwnerTaxToExtract: 300_000,
      privateCapitalConsumed: 0,
      companyCapitalConsumed: 1_000_000,
      remainingPrivateDebt: 0,
      remainingCompanyDebt: 0,
    });
    const priv = calculateFamilyNetWorth({
      privateCashAfterProject: 1_500_000,
      companyValueAfterProject: 0,
      deferredOwnerTaxToExtract: 0,
      privateCapitalConsumed: 1_000_000,
      companyCapitalConsumed: 0,
      remainingPrivateDebt: 0,
      remainingCompanyDebt: 0,
    });
    expect(priv.familyNetWorthDeltaModeB).toBeGreaterThan(company.familyNetWorthDeltaModeB);
  });

  it("subtracts remaining debt on both sides", () => {
    const r = calculateFamilyNetWorth({
      privateCashAfterProject: 1_000_000,
      companyValueAfterProject: 0,
      deferredOwnerTaxToExtract: 0,
      privateCapitalConsumed: 0,
      companyCapitalConsumed: 0,
      remainingPrivateDebt: 250_000,
      remainingCompanyDebt: 100_000,
    });
    expect(r.familyNetWorthDeltaModeA).toBe(650_000);
  });
});

describe("cash flow", () => {
  const params = {
    holdingPeriodMonths: 12,
    purchasePrice: 3_600_000,
    purchaseCosts: 54_825,
    renovationCashCost: 1_000_000,
    renovationSpreadMonths: 6,
    runningCostAnnual: 60_000,
    rentalIncomeTotal: 0,
    interestTotal: 100_000,
    amortizationAnnual: 0,
    loanDrawdown: 2_000_000,
    salePrice: 6_000_000,
    saleCosts: 200_000,
    taxAtExit: 250_000,
  };

  it("reports the peak funding need before the sale settles it", () => {
    const cf = buildCashFlow(params);
    expect(cf.months).toHaveLength(13);
    expect(cf.peakCashRequirement).toBeGreaterThan(0);
    expect(cf.monthOfMaxFundingNeed).toBeGreaterThan(0);
    expect(cf.monthOfMaxFundingNeed).toBeLessThan(12);
  });

  it("counts the loan drawdown as reducing the equity needed", () => {
    const withLoan = buildCashFlow(params);
    const withoutLoan = buildCashFlow({ ...params, loanDrawdown: 0 });
    expect(withLoan.peakCashRequirement).toBeLessThan(withoutLoan.peakCashRequirement);
    expect(withLoan.peakDebt).toBe(2_000_000);
  });

  it("repays the full outstanding loan from the sale proceeds at exit", () => {
    // A buyer's bank does not let debt ride past settlement — whatever the
    // project still owes must come out of the sale price, not vanish.
    const cf = buildCashFlow(params);
    const exit = cf.months[cf.months.length - 1];
    expect(exit.loanRepayment).toBe(2_000_000);

    // No month before exit repays it, and no month after exit exists to.
    for (const m of cf.months.slice(0, -1)) {
      expect(m.loanRepayment).toBe(0);
    }
  });

  it("repays only what is left after scheduled amortization, not the original loan again", () => {
    const amortizing = buildCashFlow({ ...params, amortizationAnnual: 120_000 });
    const exit = amortizing.months[amortizing.months.length - 1];
    // 2,000,000 drawn, 120,000 amortized on schedule over the year.
    expect(exit.loanRepayment).toBeCloseTo(2_000_000 - 120_000, 6);
  });

  it("does not let the exit-month repayment inflate the peak debt reading", () => {
    const cf = buildCashFlow(params);
    expect(cf.peakDebt).toBe(2_000_000);
  });

  it("closes the project cash-neutral on debt: nothing owed is left unpaid", () => {
    // The claim the headline profit figures rely on — that the loan is fully
    // settled — must actually hold in the cash flow that backs them.
    const cf = buildCashFlow(params);
    const totalDrawn = cf.months.reduce((s, m) => s + m.loanDrawdown, 0);
    const totalRepaid = cf.months.reduce((s, m) => s + m.amortization + m.loanRepayment, 0);
    expect(totalRepaid).toBeCloseTo(totalDrawn, 6);
  });

  it("keeps amortization out of the project result but in the cash flow", () => {
    const amortizing = buildCashFlow({ ...params, amortizationAnnual: 120_000 });
    expect(amortizing.totalInterest).toBe(params.interestTotal);
    const totalAmort = amortizing.months.reduce((s, m) => s + m.amortization, 0);
    expect(totalAmort).toBeCloseTo(120_000, 6);
  });

  it("never books rental income during the renovation months", () => {
    // A house being actively renovated cannot be rented out at the same
    // time — renovationSpreadMonths is 6, so months 1-6 must show nothing.
    const rented = buildCashFlow({ ...params, rentalIncomeTotal: 120_000 });
    for (const m of rented.months.filter((m) => m.month >= 1 && m.month <= 6)) {
      expect(m.rentalIncome).toBe(0);
    }
  });

  it("spreads the full rental income only across the months after renovation", () => {
    const rented = buildCashFlow({ ...params, rentalIncomeTotal: 120_000 });
    const afterReno = rented.months.filter((m) => m.month > 6);
    const total = afterReno.reduce((s, m) => s + m.rentalIncome, 0);
    expect(total).toBeCloseTo(120_000, 6);
    // 12-month project, 6 months of renovation, 6 months left to rent.
    expect(afterReno[0].rentalIncome).toBeCloseTo(120_000 / 6, 6);
  });

  it("books no rental income at all when renovation consumes the whole holding period", () => {
    const shortProject = { ...params, holdingPeriodMonths: 4, renovationSpreadMonths: 6 };
    const rented = buildCashFlow({ ...shortProject, rentalIncomeTotal: 50_000 });
    for (const m of rented.months) {
      expect(m.rentalIncome).toBe(0);
    }
  });
});

describe("opportunity cost", () => {
  it("charges the alternative return on average capital tied up", () => {
    const cf = buildCashFlow({
      holdingPeriodMonths: 12,
      purchasePrice: 1_000_000,
      purchaseCosts: 0,
      renovationCashCost: 0,
      renovationSpreadMonths: 1,
      runningCostAnnual: 0,
      rentalIncomeTotal: 0,
      interestTotal: 0,
      amortizationAnnual: 0,
      loanDrawdown: 0,
      salePrice: 1_000_000,
      saleCosts: 0,
      taxAtExit: 0,
    });
    const r = calculateOpportunityCost({
      cashFlow: cf,
      annualAlternativeReturnRate: 0.05,
      holdingPeriodMonths: 12,
    });
    expect(r.averageEquityCapitalTiedUp).toBeGreaterThan(0);
    expect(r.opportunityCost).toBeCloseTo(r.averageEquityCapitalTiedUp * 0.05, 6);
  });

  it("is zero at a zero alternative return", () => {
    const cf = buildCashFlow({
      holdingPeriodMonths: 6,
      purchasePrice: 1_000_000,
      purchaseCosts: 0,
      renovationCashCost: 0,
      renovationSpreadMonths: 1,
      runningCostAnnual: 0,
      rentalIncomeTotal: 0,
      interestTotal: 0,
      amortizationAnnual: 0,
      loanDrawdown: 0,
      salePrice: 1_000_000,
      saleCosts: 0,
      taxAtExit: 0,
    });
    expect(
      calculateOpportunityCost({
        cashFlow: cf,
        annualAlternativeReturnRate: 0,
        holdingPeriodMonths: 6,
      }).opportunityCost,
    ).toBe(0);
  });
});
