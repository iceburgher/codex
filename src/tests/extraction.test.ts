import { describe, expect, it } from "vitest";
import { calculateDividendGrossUp, distributeDividend } from "@/calculations/dividend";
import { calculateSalaryExtraction } from "@/calculations/salary";
import { calculateExtraction } from "@/calculations/extraction";
import { calculatePrivateLoans, calculateInterest } from "@/calculations/loans";
import type { DividendInputs } from "@/types";

const dividend: DividendInputs = {
  availableLowTaxAllowance: 200_000,
  dividendTaxWithinAllowance: 0.2,
  dividendTaxAboveAllowance: null,
};

describe("dividend gross-up", () => {
  it("grosses up a net target within the allowance", () => {
    const r = calculateDividendGrossUp({ targetNetPrivateCash: 160_000, dividend });
    expect(r.grossDividendRequired).toBeCloseTo(200_000, 6);
    expect(r.dividendTax).toBeCloseTo(40_000, 6);
    expect(r.netCashToOwner).toBeCloseTo(160_000, 6);
    expect(r.allowanceExceeded).toBe(false);
  });

  it("splits at the allowance and flags the excess when no rate is supplied", () => {
    const r = calculateDividendGrossUp({ targetNetPrivateCash: 400_000, dividend });
    expect(r.withinAllowanceGross).toBe(200_000);
    expect(r.aboveAllowanceGross).toBeCloseTo(240_000, 6);
    expect(r.aboveAllowanceTax).toBe(0);
    expect(r.allowanceExceeded).toBe(true);
  });

  it("uses the advisor-supplied rate above the allowance when given", () => {
    const r = calculateDividendGrossUp({
      targetNetPrivateCash: 400_000,
      dividend: { ...dividend, dividendTaxAboveAllowance: 0.5 },
    });
    expect(r.withinAllowanceGross).toBe(200_000);
    expect(r.aboveAllowanceGross).toBeCloseTo(480_000, 6);
    expect(r.netCashToOwner).toBeCloseTo(400_000, 6);
  });

  it("returns zeros for a zero target", () => {
    const r = calculateDividendGrossUp({ targetNetPrivateCash: 0, dividend });
    expect(r.grossDividendRequired).toBe(0);
    expect(r.dividendTax).toBe(0);
  });
});

describe("dividend distribution of available profit", () => {
  it("taxes only what fits in the allowance when no above-rate is given", () => {
    const r = distributeDividend({ grossAvailable: 500_000, dividend });
    expect(r.withinAllowanceGross).toBe(200_000);
    expect(r.aboveAllowanceGross).toBe(300_000);
    expect(r.dividendTax).toBeCloseTo(40_000, 6);
    expect(r.allowanceExceeded).toBe(true);
  });
});

describe("salary extraction", () => {
  it("shows the full company cash cost per private krona", () => {
    const r = calculateSalaryExtraction({
      targetNetSalary: 100_000,
      salary: { effectiveMarginalIncomeTaxRate: 0.5, employerContributionRate: 0.3142 },
    });
    expect(r.grossSalary).toBeCloseTo(200_000, 6);
    expect(r.employerContribution).toBeCloseTo(62_840, 6);
    expect(r.companyCashCost).toBeCloseTo(262_840, 6);
    expect(r.companyCashCostPerPrivateSek).toBeCloseTo(2.6284, 4);
  });

  it("returns zeros for a zero target", () => {
    const r = calculateSalaryExtraction({
      targetNetSalary: 0,
      salary: { effectiveMarginalIncomeTaxRate: 0.5, employerContributionRate: 0.3142 },
    });
    expect(r.companyCashCost).toBe(0);
  });
});

describe("second tax layer", () => {
  it("separates retained company profit from net private cash", () => {
    const r = calculateExtraction({
      companyProfitAfterTax: 1_000_000,
      dividend: { ...dividend, dividendTaxAboveAllowance: 0.5 },
      extractionShare: 1,
    });
    expect(r.withinDividendAllowance).toBe(200_000);
    expect(r.aboveDividendAllowance).toBe(800_000);
    expect(r.ownerExtractionTax).toBeCloseTo(40_000 + 400_000, 6);
    expect(r.netPrivateFromCompanyProfit).toBeCloseTo(560_000, 6);
    expect(r.retainedInCompany).toBe(0);
  });

  it("keeps undistributed profit inside the company", () => {
    const r = calculateExtraction({
      companyProfitAfterTax: 1_000_000,
      dividend,
      extractionShare: 0.5,
    });
    expect(r.retainedInCompany).toBe(500_000);
    expect(r.netPrivateFromCompanyProfit).toBeCloseTo(460_000, 6);
  });
});

describe("loan interest", () => {
  it("prorates interest by holding period", () => {
    expect(calculateInterest(2_000_000, 0.05, 12)).toBe(100_000);
    expect(calculateInterest(2_000_000, 0.05, 6)).toBe(50_000);
    expect(calculateInterest(0, 0.05, 12)).toBe(0);
  });

  it("gives no deduction on unsecured interest from 2026", () => {
    const r = calculatePrivateLoans({
      loans: {
        mortgageAmount: 2_000_000,
        mortgageInterestRate: 0.045,
        mortgageSetupFee: 5_000,
        mortgageAmortizationAnnual: 40_000,
        unsecuredLoanAmount: 500_000,
        unsecuredInterestRate: 0.09,
        unsecuredSetupFee: 2_000,
        unsecuredAmortizationAnnual: 0,
        securedLoanInterestDeductionRate: 0.3,
        unsecuredLoanInterestDeductionRate: 0,
        companyLoanAmount: 0,
        companyLoanInterestRate: 0,
      },
      holdingPeriodMonths: 12,
      numberOfOwners: 1,
      securedLoanInterestDeductionRateTier2: 0.21,
      securedLoanInterestDeductionThresholdPerPerson: 100_000,
    });
    expect(r.grossMortgageInterest).toBeCloseTo(90_000, 6);
    // Under tröskeln (100 000 kr för en ägare), så hela beloppet stannar i 30 %-steget.
    expect(r.mortgageTaxReduction).toBeCloseTo(27_000, 6);
    expect(r.netMortgageInterest).toBeCloseTo(63_000, 6);
    expect(r.grossUnsecuredInterest).toBeCloseTo(45_000, 6);
    expect(r.unsecuredTaxReduction).toBe(0);
    expect(r.netUnsecuredInterest).toBeCloseTo(45_000, 6);
    expect(r.totalSetupFees).toBe(7_000);
    expect(r.totalAmortization).toBe(40_000);
  });

  it("treats a loan from the owner's own company like an unsecured loan for interest deduction", () => {
    const r = calculatePrivateLoans({
      loans: {
        mortgageAmount: 0,
        mortgageInterestRate: 0,
        mortgageSetupFee: 0,
        mortgageAmortizationAnnual: 0,
        unsecuredLoanAmount: 0,
        unsecuredInterestRate: 0,
        unsecuredSetupFee: 0,
        unsecuredAmortizationAnnual: 0,
        securedLoanInterestDeductionRate: 0.3,
        unsecuredLoanInterestDeductionRate: 0,
        companyLoanAmount: 600_000,
        companyLoanInterestRate: 0.05,
      },
      holdingPeriodMonths: 12,
      numberOfOwners: 1,
      securedLoanInterestDeductionRateTier2: 0.21,
      securedLoanInterestDeductionThresholdPerPerson: 100_000,
    });
    expect(r.grossCompanyLoanInterest).toBeCloseTo(30_000, 6);
    expect(r.companyLoanTaxReduction).toBe(0);
    expect(r.netCompanyLoanInterest).toBeCloseTo(30_000, 6);
  });

  it("steps the mortgage interest deduction down to 21% above the per-person threshold", () => {
    // 150,000 kr ränta, en ägare: 100,000 @ 30 % + 50,000 @ 21 %.
    const r = calculatePrivateLoans({
      loans: {
        mortgageAmount: 3_000_000,
        mortgageInterestRate: 0.05, // gross interest = 150,000 over 12 months
        mortgageSetupFee: 0,
        mortgageAmortizationAnnual: 0,
        unsecuredLoanAmount: 0,
        unsecuredInterestRate: 0,
        unsecuredSetupFee: 0,
        unsecuredAmortizationAnnual: 0,
        securedLoanInterestDeductionRate: 0.3,
        unsecuredLoanInterestDeductionRate: 0,
        companyLoanAmount: 0,
        companyLoanInterestRate: 0,
      },
      holdingPeriodMonths: 12,
      numberOfOwners: 1,
      securedLoanInterestDeductionRateTier2: 0.21,
      securedLoanInterestDeductionThresholdPerPerson: 100_000,
    });
    expect(r.grossMortgageInterest).toBeCloseTo(150_000, 6);
    expect(r.mortgageTaxReduction).toBeCloseTo(100_000 * 0.3 + 50_000 * 0.21, 6);
  });

  it("doubles the threshold for two owners before the lower rate applies", () => {
    const oneOwner = calculatePrivateLoans({
      loans: {
        mortgageAmount: 3_000_000,
        mortgageInterestRate: 0.05,
        mortgageSetupFee: 0,
        mortgageAmortizationAnnual: 0,
        unsecuredLoanAmount: 0,
        unsecuredInterestRate: 0,
        unsecuredSetupFee: 0,
        unsecuredAmortizationAnnual: 0,
        securedLoanInterestDeductionRate: 0.3,
        unsecuredLoanInterestDeductionRate: 0,
        companyLoanAmount: 0,
        companyLoanInterestRate: 0,
      },
      holdingPeriodMonths: 12,
      numberOfOwners: 1,
      securedLoanInterestDeductionRateTier2: 0.21,
      securedLoanInterestDeductionThresholdPerPerson: 100_000,
    });
    const twoOwners = calculatePrivateLoans({
      loans: {
        mortgageAmount: 3_000_000,
        mortgageInterestRate: 0.05,
        mortgageSetupFee: 0,
        mortgageAmortizationAnnual: 0,
        unsecuredLoanAmount: 0,
        unsecuredInterestRate: 0,
        unsecuredSetupFee: 0,
        unsecuredAmortizationAnnual: 0,
        securedLoanInterestDeductionRate: 0.3,
        unsecuredLoanInterestDeductionRate: 0,
        companyLoanAmount: 0,
        companyLoanInterestRate: 0,
      },
      holdingPeriodMonths: 12,
      numberOfOwners: 2,
      securedLoanInterestDeductionRateTier2: 0.21,
      securedLoanInterestDeductionThresholdPerPerson: 100_000,
    });
    // Two owners keep more of the 150,000 kr interest in the 30% tier
    // (200,000 kr threshold instead of 100,000), so the deduction is larger.
    expect(twoOwners.mortgageTaxReduction).toBeGreaterThan(oneOwner.mortgageTaxReduction);
    expect(twoOwners.mortgageTaxReduction).toBeCloseTo(150_000 * 0.3, 6);
  });
});
