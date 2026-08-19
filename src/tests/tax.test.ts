import { describe, expect, it } from "vitest";
import { calculatePrivateCapitalGain } from "@/calculations/capitalGain";
import { calculateCorporateTax } from "@/calculations/corporateTax";
import { calculateRental } from "@/calculations/rental";
import { calculateBenefitTax } from "@/calculations/benefitTax";
import { calculatePropertyFee } from "@/calculations/operatingCosts";
import { calculateRoi } from "@/calculations/roi";
import { calculateCompanyFunding } from "@/calculations/fundingCompany";
import type { CompanyFundingInputs, RentalInputs } from "@/types";

describe("private capital gain", () => {
  const base = {
    salePrice: 6_000_000,
    saleCosts: 200_000,
    purchasePrice: 3_600_000,
    eligiblePurchaseCosts: 54_825,
    eligibleImprovementCosts: 900_000,
    privateResidentialEffectiveRate: 0.22,
    businessPropertyEffectiveRate: 0.27,
    propertyTradingRateAssumption: 0.5,
    privateResidentialLossReliefRate: 0.15,
    businessPropertyLossReliefRate: 0.189,
  };

  it("applies 22% only for an explicit private residential classification", () => {
    const r = calculatePrivateCapitalGain({
      ...base,
      classification: "private_residential_property",
    });
    expect(r.taxBasis).toBeCloseTo(4_554_825, 6);
    expect(r.capitalGain).toBeCloseTo(1_245_175, 6);
    expect(r.capitalGainTax).toBeCloseTo(273_938.5, 4);
  });

  it("applies 27% (IL 45:33, 90% i kapital) for a business property, not the residential rate", () => {
    const r = calculatePrivateCapitalGain({
      ...base,
      classification: "business_property",
    });
    expect(r.capitalGainTax).toBeCloseTo(1_245_175 * 0.27, 4);
  });

  it("does not apply 22% or 27% to a trading-risk classification", () => {
    const r = calculatePrivateCapitalGain({
      ...base,
      classification: "property_trading_inventory_risk",
    });
    expect(r.capitalGainTax).toBeCloseTo(1_245_175 * 0.5, 4);
  });

  it("gives a private residential loss a 15% effective relief (50% deductible x 30% capital tax), not zero", () => {
    const r = calculatePrivateCapitalGain({
      ...base,
      salePrice: 3_000_000,
      classification: "private_residential_property",
    });
    expect(r.capitalGain).toBeLessThan(0);
    expect(r.capitalGainTax).toBeCloseTo(-Math.abs(r.capitalGain) * 0.15, 4);
    expect(r.capitalGainTax).toBeLessThan(0);
  });

  it("gives a business property loss a larger 18.9% relief (63% deductible x 30%)", () => {
    const residential = calculatePrivateCapitalGain({
      ...base,
      salePrice: 3_000_000,
      classification: "private_residential_property",
    });
    const business = calculatePrivateCapitalGain({
      ...base,
      salePrice: 3_000_000,
      classification: "business_property",
    });
    // Larger relief rate means a bigger (more negative) tax credit.
    expect(business.capitalGainTax).toBeLessThan(residential.capitalGainTax);
  });

  it("shows all three real classifications side by side when not yet determined, without picking one for the user", () => {
    const r = calculatePrivateCapitalGain({ ...base, classification: "not_yet_determined" });
    expect(r.alternativeClassifications).toBeDefined();
    expect(r.alternativeClassifications).toHaveLength(3);
    const byClassification = Object.fromEntries(
      r.alternativeClassifications!.map((a) => [a.classification, a.capitalGainTax]),
    );
    expect(byClassification.private_residential_property).toBeCloseTo(273_938.5, 4);
    expect(byClassification.business_property).toBeCloseTo(1_245_175 * 0.27, 4);
    expect(byClassification.property_trading_inventory_risk).toBeCloseTo(1_245_175 * 0.5, 4);
    // Huvudsiffran räknar konservativt med handel tills klassificeringen är bekräftad.
    expect(r.capitalGainTax).toBeCloseTo(1_245_175 * 0.5, 4);
  });

  it("never sets alternativeClassifications for a resolved classification", () => {
    const r = calculatePrivateCapitalGain({
      ...base,
      classification: "private_residential_property",
    });
    expect(r.alternativeClassifications).toBeUndefined();
  });
});

describe("corporate tax", () => {
  it("taxes the disposal result net of other project costs", () => {
    const r = calculateCorporateTax({
      salePrice: 6_000_000,
      saleCosts: 200_000,
      companyTaxBasis: 4_800_000,
      otherDeductibleResult: -100_000,
      corporateTaxRate: 0.206,
      classification: "capital_asset",
      disposalTaxExempt: false,
    });
    expect(r.taxableSaleResult).toBe(900_000);
    expect(r.companyTax).toBeCloseTo(185_400, 6);
    expect(r.companyProfitAfterTax).toBeCloseTo(714_600, 6);
  });

  it("charges no tax on a loss but keeps the negative result", () => {
    const r = calculateCorporateTax({
      salePrice: 4_000_000,
      saleCosts: 200_000,
      companyTaxBasis: 4_800_000,
      otherDeductibleResult: 0,
      corporateTaxRate: 0.206,
      classification: "inventory_property",
      disposalTaxExempt: false,
    });
    expect(r.companyTax).toBe(0);
    expect(r.companyProfitAfterTax).toBe(-1_000_000);
  });

  it("surfaces the deferred tax asset on a loss without adding it to the profit shown", () => {
    // A corporate loss is never cash back — it's a carried-forward deduction
    // only worth something against future taxable profit the company may
    // never have, so it must never be folded into companyProfitAfterTax.
    const r = calculateCorporateTax({
      salePrice: 4_000_000,
      saleCosts: 200_000,
      companyTaxBasis: 4_800_000,
      otherDeductibleResult: 0,
      corporateTaxRate: 0.206,
      classification: "inventory_property",
      disposalTaxExempt: false,
    });
    expect(r.deferredTaxAssetValue).toBeCloseTo(1_000_000 * 0.206, 6);
    expect(r.companyProfitAfterTax).toBe(-1_000_000);
  });

  it("reports no deferred tax asset when the sale is profitable", () => {
    const r = calculateCorporateTax({
      salePrice: 6_000_000,
      saleCosts: 200_000,
      companyTaxBasis: 4_800_000,
      otherDeductibleResult: -100_000,
      corporateTaxRate: 0.206,
      classification: "capital_asset",
      disposalTaxExempt: false,
    });
    expect(r.deferredTaxAssetValue).toBe(0);
  });

  it("exempts the disposal gain from tax under a share sale (paketering), but still taxes ongoing results", () => {
    const assetSale = calculateCorporateTax({
      salePrice: 6_000_000,
      saleCosts: 200_000,
      companyTaxBasis: 4_800_000,
      otherDeductibleResult: -100_000,
      corporateTaxRate: 0.206,
      classification: "capital_asset",
      disposalTaxExempt: false,
    });
    const shareSale = calculateCorporateTax({
      salePrice: 6_000_000,
      saleCosts: 200_000,
      companyTaxBasis: 4_800_000,
      otherDeductibleResult: -100_000,
      corporateTaxRate: 0.206,
      classification: "capital_asset",
      disposalTaxExempt: true,
    });
    // Only the running (non-disposal) result of -100,000 is taxable, so the
    // share sale pays less tax and keeps more profit than the asset sale —
    // but both start from the same total economic result.
    expect(shareSale.companyTax).toBe(0); // -100,000 taxable result: no tax due
    expect(shareSale.companyTax).toBeLessThan(assetSale.companyTax);
    expect(shareSale.companyProfitAfterTax).toBeGreaterThan(assetSale.companyProfitAfterTax);
  });
});

describe("private rental tax", () => {
  const rental: RentalInputs = {
    enabled: true,
    rentedWeeks: 10,
    rentPerWeek: 15_000,
    platformFeePercent: 0.15,
    cleaningPerStay: 1_500,
    numberOfStays: 10,
    extraUtilities: 5_000,
    extraWearAndTear: 0,
  };

  it("applies the standard and percentage deductions", () => {
    const r = calculateRental({
      rental,
      holdingPeriodMonths: 12,
      isPrivateOwned: true,
      isPrivateResidential: true,
      rentalStandardDeduction: 40_000,
      rentalPercentDeduction: 0.2,
      capitalIncomeTaxRate: 0.3,
    });
    expect(r.grossRentalIncome).toBe(150_000);
    expect(r.standardDeduction).toBe(40_000);
    expect(r.percentDeduction).toBe(30_000);
    expect(r.privateTaxableRentalSurplus).toBe(80_000);
    expect(r.privateRentalTax).toBeCloseTo(24_000, 6);
  });

  it("prorates the standard deduction for a part-year holding", () => {
    const r = calculateRental({
      rental,
      holdingPeriodMonths: 6,
      isPrivateOwned: true,
      isPrivateResidential: true,
      rentalStandardDeduction: 40_000,
      rentalPercentDeduction: 0.2,
      capitalIncomeTaxRate: 0.3,
    });
    expect(r.standardDeduction).toBe(20_000);
  });

  it("never produces a negative taxable surplus", () => {
    const r = calculateRental({
      rental: { ...rental, rentedWeeks: 1, rentPerWeek: 10_000 },
      holdingPeriodMonths: 12,
      isPrivateOwned: true,
      isPrivateResidential: true,
      rentalStandardDeduction: 40_000,
      rentalPercentDeduction: 0.2,
      capitalIncomeTaxRate: 0.3,
    });
    expect(r.privateTaxableRentalSurplus).toBe(0);
    expect(r.privateRentalTax).toBe(0);
  });

  it("returns zeros when rental is disabled", () => {
    const r = calculateRental({
      rental: { ...rental, enabled: false },
      holdingPeriodMonths: 12,
      isPrivateOwned: true,
      isPrivateResidential: true,
      rentalStandardDeduction: 40_000,
      rentalPercentDeduction: 0.2,
      capitalIncomeTaxRate: 0.3,
    });
    expect(r.grossRentalIncome).toBe(0);
  });

  it("computes a company rental profit net of direct costs", () => {
    const r = calculateRental({
      rental,
      holdingPeriodMonths: 12,
      isPrivateOwned: false,
      isPrivateResidential: false,
      rentalStandardDeduction: 40_000,
      rentalPercentDeduction: 0.2,
      capitalIncomeTaxRate: 0.3,
    });
    expect(r.deductibleRentalCosts).toBeCloseTo(22_500 + 15_000 + 5_000, 6);
    expect(r.companyRentalProfit).toBeCloseTo(107_500, 6);
  });

  it("withholds the standard and percentage deductions when the property is not classified as a private residence", () => {
    // Schablonavdraget och 20 %-avdraget gäller bara privatbostad. En
    // näringsfastighet eller handelsklassad fastighet hyrs ut på vanliga
    // kapitalregler: skatt på gross minus faktiska kostnader, inget schablon.
    const r = calculateRental({
      rental,
      holdingPeriodMonths: 12,
      isPrivateOwned: true,
      isPrivateResidential: false,
      rentalStandardDeduction: 40_000,
      rentalPercentDeduction: 0.2,
      capitalIncomeTaxRate: 0.3,
    });
    expect(r.standardDeduction).toBe(0);
    expect(r.percentDeduction).toBe(0);
    expect(r.privateTaxableRentalSurplus).toBeCloseTo(150_000 - (22_500 + 15_000 + 5_000), 6);
  });
});

describe("benefit taxation", () => {
  it("charges owner tax and employer contributions on the prorated benefit", () => {
    const r = calculateBenefitTax({
      benefit: {
        estimatedAnnualMarketBenefitValue: 240_000,
        ownerIncomeTaxRateOnBenefit: 0.52,
        employerContributionRate: 0.3142,
      },
      privateUseLevel: "full_disposition",
      holdingPeriodMonths: 12,
      isCompanyOwned: true,
    });
    expect(r.proratedBenefitValue).toBe(240_000);
    expect(r.ownerBenefitTax).toBeCloseTo(124_800, 6);
    expect(r.companyEmployerContributionOnBenefit).toBeCloseTo(75_408, 6);
    expect(r.combinedEconomicCost).toBeCloseTo(200_208, 6);
  });

  it("is zero for private ownership or no private use", () => {
    const noUse = calculateBenefitTax({
      benefit: {
        estimatedAnnualMarketBenefitValue: 240_000,
        ownerIncomeTaxRateOnBenefit: 0.52,
        employerContributionRate: 0.3142,
      },
      privateUseLevel: "none",
      holdingPeriodMonths: 12,
      isCompanyOwned: true,
    });
    expect(noUse.combinedEconomicCost).toBe(0);
  });
});

describe("property fee", () => {
  it("is capped at the annual maximum", () => {
    expect(calculatePropertyFee(5_000_000, 0.0075, 10_425)).toBe(10_425);
  });

  it("uses the percentage below the cap", () => {
    expect(calculatePropertyFee(1_000_000, 0.0075, 10_425)).toBe(7_500);
  });

  it("is zero without a tax assessment value", () => {
    expect(calculatePropertyFee(0, 0.0075, 10_425)).toBe(0);
  });

  it("is exempt for new construction with a value year of 2012 or later, within 15 years", () => {
    expect(
      calculatePropertyFee(5_000_000, 0.0075, 10_425, { constructionYear: 2020, taxYear: 2026 }),
    ).toBe(0);
  });

  it("charges the normal fee once the 15-year new-construction exemption has passed", () => {
    expect(
      calculatePropertyFee(5_000_000, 0.0075, 10_425, { constructionYear: 2005, taxYear: 2026 }),
    ).toBe(10_425);
  });

  it("charges the normal fee for a value year before 2012, even within what would be the 15-year window", () => {
    expect(
      calculatePropertyFee(5_000_000, 0.0075, 10_425, { constructionYear: 2010, taxYear: 2020 }),
    ).toBe(10_425);
  });

  it("charges the normal fee when the construction year is unknown", () => {
    expect(
      calculatePropertyFee(5_000_000, 0.0075, 10_425, { constructionYear: null, taxYear: 2026 }),
    ).toBe(10_425);
  });
});

describe("roi metrics", () => {
  const base = {
    totalProjectCost: 5_000_000,
    projectProfit: 500_000,
    investedEquity: 1_000_000,
    netProfit: 500_000,
    holdingPeriodMonths: 12,
  };

  it("computes owner-loan ROI from profit after corporate tax over the loan alone, not prorated and never counting repayment as return", () => {
    // Ägarlån = 2 000 000 kr, projektvinst efter bolagsskatt = 600 000 kr.
    // ROI = 600 000 / 2 000 000 = 30 %, INTE (600 000 + 2 000 000) / 2 000 000.
    const r = calculateRoi({
      ...base,
      companyProfitAfterTax: 600_000,
      ownerLoanAmount: 2_000_000,
    });
    expect(r.ownerLoanROI).toBeCloseTo(0.3, 6);
  });

  it("is null for owner-loan ROI when there is no owner loan", () => {
    const r = calculateRoi({ ...base, companyProfitAfterTax: 600_000, ownerLoanAmount: 0 });
    expect(r.ownerLoanROI).toBeNull();
  });

  it("computes company ROI over the company's own bound capital (cash + tillskott + ägarlån)", () => {
    const r = calculateRoi({
      ...base,
      companyProfitAfterTax: 600_000,
      companyBoundCapital: 1_800_000 + 200_000 + 2_000_000,
    });
    expect(r.companyROI).toBeCloseTo(600_000 / 4_000_000, 6);
  });

  it("computes private net ROI over capital actually put in privately, separate from the company's capital", () => {
    const r = calculateRoi({
      ...base,
      privateNetProfit: 150_000,
      privateCapitalPutIn: 500_000,
    });
    expect(r.privateNetROI).toBeCloseTo(0.3, 6);
  });

  it("is null rather than Infinity/NaN when the relevant denominator is zero", () => {
    const r = calculateRoi(base);
    expect(r.companyROI).toBeNull();
    expect(r.ownerLoanROI).toBeNull();
    expect(r.privateNetROI).toBeNull();
  });
});

describe("company funding: owner loan", () => {
  const funding: CompanyFundingInputs = {
    companyCashInvested: 1_000_000,
    externalBusinessLoan: 3_000_000,
    businessInterestRate: 0.05,
    setupFee: 0,
    guaranteeFee: 0,
    amortizationAnnual: 0,
    deductibleInterestPercent: 1,
    personalGuarantee: false,
    ownerLoanAmount: 2_000_000,
    ownerLoanInterestRate: 0.04,
    ownerLoanAnnualRepayment: 0,
    ownerLoanDeductibleInterestPercent: 0.5,
    shareholderContribution: 200_000,
  };

  it("computes owner-loan interest with its own rate, separate from the business loan", () => {
    const r = calculateCompanyFunding({ funding, holdingPeriodMonths: 12 });
    expect(r.ownerLoanInterest).toBeCloseTo(2_000_000 * 0.04, 6);
    expect(r.businessInterest).toBeCloseTo(3_000_000 * 0.05, 6);
  });

  it("applies the owner loan's own deductible-interest field, not the business loan's", () => {
    const r = calculateCompanyFunding({ funding, holdingPeriodMonths: 12 });
    expect(r.ownerLoanDeductibleInterest).toBeCloseTo(2_000_000 * 0.04 * 0.5, 6);
    expect(r.deductibleInterest).toBeCloseTo(3_000_000 * 0.05, 6);
  });

  it("counts shareholder contribution as equity, and includes owner loan in the max cash requirement", () => {
    const r = calculateCompanyFunding({ funding, holdingPeriodMonths: 12 });
    expect(r.totalEquityCommitted).toBe(1_000_000 + 200_000);
    expect(r.maxCashRequirement).toBe(1_000_000 + 200_000 + 3_000_000 + 2_000_000);
    // "debt" stays external-only — owner loan is itemized separately.
    expect(r.debt).toBe(3_000_000);
  });
});
