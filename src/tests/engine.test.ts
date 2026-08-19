import { describe, expect, it } from "vitest";
import { calculateAllScenarios, calculateScenario } from "@/calculations/engine";
import { buildSensitivityMatrix } from "@/calculations/sensitivity";
import { buildAdvisorQuestions } from "@/calculations/advisorQuestions";
import { bestScenarioIndex } from "@/components/dashboard/ScenarioCards";
import { createBlankProject, defaultSale } from "@/lib/defaults";
import type { PropertyProject } from "@/types";

function baseProject(): PropertyProject {
  const p = createBlankProject("test-1", "Test project");
  p.inputs.purchasePrice = 3_600_000;
  p.inputs.expectedSalePrice = 6_000_000;
  p.inputs.priorYearTaxAssessmentValue = 2_500_000;
  p.inputs.existingMortgageDeeds = 0;
  p.inputs.holdingPeriodMonths = 12;
  p.renovation.laborGross = 600_000;
  p.renovation.materialsGross = 400_000;
  p.sale.brokerFeePercent = 0.025;
  p.sale.priceNegotiationBufferRate = 0;

  p.scenarios.PRIVATE_DEBT.privateLoans.mortgageAmount = 2_500_000;
  p.scenarios.PRIVATE_DEBT.privateLoans.mortgageInterestRate = 0.045;
  p.scenarios.PRIVATE_EQUITY.privateFunding.existingPrivateCash = 4_800_000;
  p.scenarios.EXISTING_COMPANY.companyFunding.companyCashInvested = 1_800_000;
  p.scenarios.EXISTING_COMPANY.companyFunding.externalBusinessLoan = 3_000_000;
  return p;
}

describe("scenario engine", () => {
  it("produces a result for every compared scenario", () => {
    const p = baseProject();
    const results = calculateAllScenarios(p);
    expect(results.map((r) => r.scenario)).toEqual(p.compareScenarios);
  });

  it("compares private with a loan against company ownership by default", () => {
    // Ett projekt av den här storleken kräver lån oavsett ägare, så de två
    // realistiska alternativen är förvalda. Övriga går att slå på.
    expect(baseProject().compareScenarios).toEqual(["PRIVATE_DEBT", "EXISTING_COMPANY"]);
  });

  it("can still calculate every ownership form that is switched on", () => {
    const p = baseProject();
    p.compareScenarios = ["PRIVATE_EQUITY", "PRIVATE_DEBT", "EXISTING_COMPANY"];
    expect(calculateAllScenarios(p)).toHaveLength(3);
  });

  it("charges a company buyer more stamp duty than a private buyer on the same facts", () => {
    const p = baseProject();
    const priv = calculateScenario(p, "PRIVATE_EQUITY");
    const comp = calculateScenario(p, "EXISTING_COMPANY");
    expect(comp.purchaseTaxesFees).toBeGreaterThan(priv.purchaseTaxesFees);
  });

  it("keeps company profit separate from what reaches the owners", () => {
    const p = baseProject();
    p.scenarios.EXISTING_COMPANY.dividend.availableLowTaxAllowance = 200_000;
    p.scenarios.EXISTING_COMPANY.dividend.dividendTaxAboveAllowance = 0.5;
    const r = calculateScenario(p, "EXISTING_COMPANY");
    expect(r.netRetainedInCompany).toBeGreaterThan(0);
    expect(r.netAvailablePrivately).toBeLessThan(r.netRetainedInCompany);
  });

  it("does not apply the 22% private rate unless the classification says so", () => {
    const p = baseProject();
    const risky = calculateScenario(p, "PRIVATE_EQUITY");
    p.scenarios.PRIVATE_EQUITY.privatePropertyTaxClassification = "private_residential_property";
    const residential = calculateScenario(p, "PRIVATE_EQUITY");
    expect(residential.capitalGain.capitalGainTax).toBeLessThan(risky.capitalGain.capitalGainTax);
  });

  it("taxes a business property at 27%, not the residential 22% or the trading-risk assumption", () => {
    const p = baseProject();
    p.scenarios.PRIVATE_EQUITY.privatePropertyTaxClassification = "business_property";
    const business = calculateScenario(p, "PRIVATE_EQUITY");
    p.scenarios.PRIVATE_EQUITY.privatePropertyTaxClassification = "private_residential_property";
    const residential = calculateScenario(p, "PRIVATE_EQUITY");
    p.scenarios.PRIVATE_EQUITY.privatePropertyTaxClassification = "property_trading_inventory_risk";
    const trading = calculateScenario(p, "PRIVATE_EQUITY");

    expect(business.capitalGain.capitalGainTax).toBeGreaterThan(residential.capitalGain.capitalGainTax);
    expect(business.capitalGain.capitalGainTax).toBeLessThan(trading.capitalGain.capitalGainTax);
  });

  it("flags handel med fastigheter as taxed like business income, not a capital gain", () => {
    const p = baseProject();
    p.scenarios.PRIVATE_EQUITY.privatePropertyTaxClassification = "property_trading_inventory_risk";
    const r = calculateScenario(p, "PRIVATE_EQUITY");
    expect(r.riskFlags.map((f) => f.id)).toContain("property_trading_not_capital_gain");
  });

  it("recognizes qualifying repairs in the capital-gains basis, not just fundamental improvements", () => {
    // Regression for a real bug: qualifyingRepairsAndMaintenancePercent was
    // defined on the type but never read by any calculation, so a large
    // renovation reduced the real cash profit (profitBeforeTax) but not the
    // taxable capital gain — to the point that the tax shown could exceed
    // the actual profit.
    const p = baseProject();
    p.scenarios.PRIVATE_EQUITY.privatePropertyTaxClassification = "private_residential_property";
    const withDefaultSplit = calculateScenario(p, "PRIVATE_EQUITY");

    p.scenarios.PRIVATE_EQUITY.improvementBasis = {
      fundamentalImprovementsPercent: 0,
      qualifyingRepairsAndMaintenancePercent: 1,
      nonDeductiblePercent: 0,
    };
    const withRepairsRecognized = calculateScenario(p, "PRIVATE_EQUITY");

    expect(withRepairsRecognized.capitalGain.capitalGainTax).toBeLessThan(
      withDefaultSplit.capitalGain.capitalGainTax,
    );
    expect(withRepairsRecognized.capitalGain.capitalGainTax).toBeLessThan(
      withRepairsRecognized.profitBeforeTax,
    );
  });

  it("warns when the improvement-basis shares do not sum to the whole renovation", () => {
    const p = baseProject();
    p.scenarios.PRIVATE_EQUITY.improvementBasis = {
      fundamentalImprovementsPercent: 0.5,
      qualifyingRepairsAndMaintenancePercent: 0.3,
      nonDeductiblePercent: 0,
    };
    const r = calculateScenario(p, "PRIVATE_EQUITY");
    expect(r.warnings.map((w) => w.id)).toContain("improvement_split");
  });

  it("never warns about the improvement-basis split for a company-owned scenario", () => {
    const p = baseProject();
    p.scenarios.EXISTING_COMPANY.improvementBasis = {
      fundamentalImprovementsPercent: 0.5,
      qualifyingRepairsAndMaintenancePercent: 0.3,
      nonDeductiblePercent: 0,
    };
    const r = calculateScenario(p, "EXISTING_COMPANY");
    expect(r.warnings.map((w) => w.id)).not.toContain("improvement_split");
  });

  it("flags an unconfirmed private residential classification", () => {
    const p = baseProject();
    p.scenarios.PRIVATE_EQUITY.privatePropertyTaxClassification = "private_residential_property";
    const r = calculateScenario(p, "PRIVATE_EQUITY");
    expect(r.riskFlags.map((f) => f.id)).toContain(
      "private_residence_classification_unconfirmed",
    );
  });

  it("warns about a deferred (not cash) tax asset when the company sale is a loss", () => {
    const p = baseProject();
    p.inputs.expectedSalePrice = 3_000_000; // below cost, forces a loss
    const r = calculateScenario(p, "EXISTING_COMPANY");
    expect(r.corporateTax?.deferredTaxAssetValue).toBeGreaterThan(0);
    expect(r.warnings.map((w) => w.id)).toContain("company_loss_deferred_tax_asset");
  });

  it("never warns about a deferred tax asset when the company sale is profitable", () => {
    const p = baseProject();
    const r = calculateScenario(p, "EXISTING_COMPANY");
    expect(r.corporateTax?.deferredTaxAssetValue).toBe(0);
    expect(r.warnings.map((w) => w.id)).not.toContain("company_loss_deferred_tax_asset");
  });

  it("makes a packaged (share) sale keep more after tax than a direct asset sale", () => {
    const p = baseProject();
    const assetSale = calculateScenario(p, "EXISTING_COMPANY");

    p.scenarios.EXISTING_COMPANY.companySaleStructure = "share_sale";
    const shareSale = calculateScenario(p, "EXISTING_COMPANY");

    expect(shareSale.corporateTax?.companyTax).toBeLessThan(assetSale.corporateTax?.companyTax ?? 0);
    expect(shareSale.netRetainedInCompany).toBeGreaterThan(assetSale.netRetainedInCompany);
  });

  it("reduces the effective sale price by the buyer's latent-tax discount under a share sale", () => {
    const p = baseProject();
    p.scenarios.EXISTING_COMPANY.companySaleStructure = "share_sale";
    const noDiscount = calculateScenario(p, "EXISTING_COMPANY");

    p.scenarios.EXISTING_COMPANY.buyerLatentTaxDiscountPercent = 0.08;
    const withDiscount = calculateScenario(p, "EXISTING_COMPANY");

    expect(withDiscount.netRetainedInCompany).toBeLessThan(noDiscount.netRetainedInCompany);
    expect(withDiscount.profitBeforeTax).toBeLessThan(noDiscount.profitBeforeTax);
  });

  it("always flags a share-sale (paketering) structure as needing legal and tax advice", () => {
    const p = baseProject();
    p.scenarios.EXISTING_COMPANY.companySaleStructure = "share_sale";
    const r = calculateScenario(p, "EXISTING_COMPANY");
    expect(r.riskFlags.map((f) => f.id)).toContain("packaging_structure_risk");
  });

  it("never flags packaging risk for a direct asset sale", () => {
    const p = baseProject();
    const r = calculateScenario(p, "EXISTING_COMPANY");
    expect(r.riskFlags.map((f) => f.id)).not.toContain("packaging_structure_risk");
  });

  it("flags a related-party purchase as an uttagsbeskattning / correction-rule risk", () => {
    const p = baseProject();
    p.scenarios.EXISTING_COMPANY.purchasedFromRelatedParty = true;
    const r = calculateScenario(p, "EXISTING_COMPANY");
    const flag = r.riskFlags.find((f) => f.id === "related_party_purchase_price_risk");
    expect(flag?.severity).toBe("high");
  });

  it("does not flag a related-party purchase when the company buys from an independent seller", () => {
    const p = baseProject();
    const r = calculateScenario(p, "EXISTING_COMPANY");
    expect(r.riskFlags.map((f) => f.id)).not.toContain("related_party_purchase_price_risk");
  });

  it("never flags a related-party purchase for private ownership, where the field is unused", () => {
    const p = baseProject();
    p.scenarios.PRIVATE_EQUITY.purchasedFromRelatedParty = true;
    const r = calculateScenario(p, "PRIVATE_EQUITY");
    expect(r.riskFlags.map((f) => f.id)).not.toContain("related_party_purchase_price_risk");
  });

  it("flags a missing tomträttsavgäld when the property sits on leasehold land", () => {
    const p = baseProject();
    p.facts.tenure = "leasehold";
    const r = calculateScenario(p, "PRIVATE_DEBT");
    const flag = r.riskFlags.find((f) => f.id === "leasehold_ground_rent_missing");
    expect(flag?.severity).toBe("medium");
  });

  it("does not flag leasehold ground rent once it is filled in", () => {
    const p = baseProject();
    p.facts.tenure = "leasehold";
    p.operatingCosts.tomtrattsavgaldAnnual = 25_000;
    const r = calculateScenario(p, "PRIVATE_DEBT");
    expect(r.riskFlags.map((f) => f.id)).not.toContain("leasehold_ground_rent_missing");
  });

  it("never flags leasehold ground rent for freehold property", () => {
    const p = baseProject();
    const r = calculateScenario(p, "PRIVATE_DEBT");
    expect(r.riskFlags.map((f) => f.id)).not.toContain("leasehold_ground_rent_missing");
  });

  it("zeroes the calculated fastighetsavgift for a new-construction property within 15 years", () => {
    const p = baseProject();
    p.facts.constructionYear = 2020;
    const r = calculateScenario(p, "PRIVATE_DEBT");
    expect(r.runningCosts.calculatedPropertyFee).toBe(0);
  });

  it("adds samfällighetsavgift and tomträttsavgäld to the running-cost total", () => {
    const p = baseProject();
    const without = calculateScenario(p, "PRIVATE_DEBT");
    p.operatingCosts.samfallighetsavgiftAnnual = 3_000;
    p.operatingCosts.tomtrattsavgaldAnnual = 15_000;
    const withFees = calculateScenario(p, "PRIVATE_DEBT");
    expect(withFees.runningCosts.totalAnnual).toBeCloseTo(
      without.runningCosts.totalAnnual + 18_000,
      6,
    );
  });

  it("nets a building depreciation deduction to zero over the holding period under a direct asset sale", () => {
    // Deducted now, recaptured (lower tax basis) at sale — same total tax
    // either way, since both the deduction and the recapture land in the
    // same single lump-sum corporate tax event this app models.
    const p = baseProject();
    const withoutDepreciation = calculateScenario(p, "EXISTING_COMPANY");

    p.scenarios.EXISTING_COMPANY.buildingValueSharePercent = 0.7;
    p.scenarios.EXISTING_COMPANY.annualDepreciationRatePercent = 0.02;
    const withDepreciation = calculateScenario(p, "EXISTING_COMPANY");

    expect(withDepreciation.corporateTax?.companyTax).toBeCloseTo(
      withoutDepreciation.corporateTax?.companyTax ?? 0,
      2,
    );
  });

  it("turns building depreciation into a permanent tax saving under a packaged (share) sale", () => {
    // The recapture would normally cancel the deduction out, but a share
    // sale never taxes the disposal at all, so the recapture escapes tax —
    // the deduction becomes a real, permanent benefit in that structure.
    // Needs a genuinely positive running result to show through (clamped-
    // to-zero tax on an already-negative result would hide the effect).
    const p = baseProject();
    p.rental.enabled = true;
    p.rental.rentedWeeks = 52;
    p.rental.rentPerWeek = 10_000;
    p.scenarios.EXISTING_COMPANY.companySaleStructure = "share_sale";
    const withoutDepreciation = calculateScenario(p, "EXISTING_COMPANY");

    p.scenarios.EXISTING_COMPANY.buildingValueSharePercent = 0.7;
    p.scenarios.EXISTING_COMPANY.annualDepreciationRatePercent = 0.02;
    const withDepreciation = calculateScenario(p, "EXISTING_COMPANY");

    expect(withDepreciation.corporateTax?.companyTax).toBeLessThan(
      withoutDepreciation.corporateTax?.companyTax ?? 0,
    );
    expect(withDepreciation.netRetainedInCompany).toBeGreaterThan(
      withoutDepreciation.netRetainedInCompany,
    );
  });

  it("steps the mortgage interest deduction down to 21% above the per-person threshold", () => {
    const p = baseProject();
    p.inputs.ownershipSharePerson2 = 0; // a single owner, so the threshold is not doubled
    p.scenarios.PRIVATE_DEBT.privateLoans.mortgageAmount = 3_000_000;
    p.scenarios.PRIVATE_DEBT.privateLoans.mortgageInterestRate = 0.05; // gross = 150,000/year
    const r = calculateScenario(p, "PRIVATE_DEBT");
    // 100,000 @ 30% + 50,000 @ 21%, not a flat 30% on the whole amount.
    expect(r.loans.mortgageTaxReduction).toBeCloseTo(100_000 * 0.3 + 50_000 * 0.21, 6);
    expect(r.loans.mortgageTaxReduction).toBeLessThan(150_000 * 0.3);
  });

  it("gives two owners a larger interest deduction than one, via a doubled threshold", () => {
    const p = baseProject();
    p.scenarios.PRIVATE_DEBT.privateLoans.mortgageAmount = 3_000_000;
    p.scenarios.PRIVATE_DEBT.privateLoans.mortgageInterestRate = 0.05;
    p.inputs.ownershipSharePerson2 = 0;
    const oneOwner = calculateScenario(p, "PRIVATE_DEBT");
    p.inputs.ownershipSharePerson2 = 0.5;
    const twoOwners = calculateScenario(p, "PRIVATE_DEBT");
    expect(twoOwners.loans.mortgageTaxReduction).toBeGreaterThan(
      oneOwner.loans.mortgageTaxReduction,
    );
  });

  it("flags private use of a company-owned property", () => {
    const p = baseProject();
    p.scenarios.EXISTING_COMPANY.privateUseLevel = "full_disposition";
    const r = calculateScenario(p, "EXISTING_COMPANY");
    expect(r.riskFlags.map((f) => f.id)).toContain("company_private_use_risk");
    expect(r.warnings.map((w) => w.id)).toContain("benefit");
  });

  it("warns when no broker fee is assumed at sale despite a sale price", () => {
    const p = baseProject();
    p.sale.brokerFeeFixed = 0;
    p.sale.brokerFeePercent = 0;
    const r = calculateScenario(p, "PRIVATE_EQUITY");
    expect(r.warnings.map((w) => w.id)).toContain("broker_fee");
  });

  it("does not warn about the broker fee once one is set", () => {
    const p = baseProject();
    p.sale.brokerFeeFixed = 0;
    p.sale.brokerFeePercent = 0.025;
    const r = calculateScenario(p, "PRIVATE_EQUITY");
    expect(r.warnings.map((w) => w.id)).not.toContain("broker_fee");
  });

  it("does not warn about the broker fee before a sale price is entered", () => {
    const p = baseProject();
    p.sale.brokerFeeFixed = 0;
    p.sale.brokerFeePercent = 0;
    p.inputs.expectedSalePrice = null;
    const r = calculateScenario(p, "PRIVATE_EQUITY");
    expect(r.warnings.map((w) => w.id)).not.toContain("broker_fee");
  });

  it("warns when the holding period leaves no time to rent out after renovation", () => {
    const p = baseProject();
    p.inputs.holdingPeriodMonths = 4; // shorter than the 6-month renovation assumption
    p.rental.enabled = true;
    p.rental.rentedWeeks = 8;
    p.rental.rentPerWeek = 5_000;
    const r = calculateScenario(p, "PRIVATE_EQUITY");
    expect(r.warnings.map((w) => w.id)).toContain("rental_no_time_after_renovation");
  });

  it("does not warn about rental timing once the holding period leaves room after renovation", () => {
    const p = baseProject();
    p.inputs.holdingPeriodMonths = 12;
    p.rental.enabled = true;
    p.rental.rentedWeeks = 8;
    p.rental.rentPerWeek = 5_000;
    const r = calculateScenario(p, "PRIVATE_EQUITY");
    expect(r.warnings.map((w) => w.id)).not.toContain("rental_no_time_after_renovation");
  });

  it("flags a shareholder loan used to fund the private purchase as a high-severity tax risk", () => {
    const p = baseProject();
    p.scenarios.PRIVATE_EQUITY.privateLoans.companyLoanAmount = 600_000;
    p.scenarios.PRIVATE_EQUITY.privateLoans.companyLoanInterestRate = 0.05;
    const r = calculateScenario(p, "PRIVATE_EQUITY");
    const flag = r.riskFlags.find((f) => f.id === "shareholder_loan_prohibition_risk");
    expect(flag?.severity).toBe("high");
  });

  it("does not flag a shareholder loan when none is used", () => {
    const p = baseProject();
    const r = calculateScenario(p, "PRIVATE_EQUITY");
    expect(r.riskFlags.map((f) => f.id)).not.toContain("shareholder_loan_prohibition_risk");
  });

  it("never flags a shareholder loan for the company-owned scenario, where the field is unused", () => {
    const p = baseProject();
    p.scenarios.EXISTING_COMPANY.privateLoans.companyLoanAmount = 600_000;
    const r = calculateScenario(p, "EXISTING_COMPANY");
    expect(r.riskFlags.map((f) => f.id)).not.toContain("shareholder_loan_prohibition_risk");
  });

  it("counts a shareholder loan as debt that reduces the cash the owners must provide", () => {
    const p = baseProject();
    const without = calculateScenario(p, "PRIVATE_EQUITY");
    p.scenarios.PRIVATE_EQUITY.privateLoans.companyLoanAmount = 600_000;
    p.scenarios.PRIVATE_EQUITY.privateLoans.companyLoanInterestRate = 0.05;
    const withLoan = calculateScenario(p, "PRIVATE_EQUITY");
    expect(withLoan.externalDebt).toBe(without.externalDebt + 600_000);
    expect(withLoan.cashFlow.peakCashRequirement).toBeLessThan(without.cashFlow.peakCashRequirement);
  });

  it("charges interest on a shareholder loan as a financing cost, reducing profit", () => {
    const p = baseProject();
    const without = calculateScenario(p, "PRIVATE_EQUITY");
    p.scenarios.PRIVATE_EQUITY.privateLoans.companyLoanAmount = 600_000;
    p.scenarios.PRIVATE_EQUITY.privateLoans.companyLoanInterestRate = 0.05;
    const withLoan = calculateScenario(p, "PRIVATE_EQUITY");
    // 600,000 kr at 5% over the 12-month holding period, no deduction (same
    // treatment as an unsecured loan from 2026).
    expect(withLoan.financingCost).toBeCloseTo(without.financingCost + 30_000, 6);
    expect(withLoan.profitAfterTax).toBeLessThan(without.profitAfterTax);
  });

  it("deducts the broker fee from the profit shown, not just from a side panel", () => {
    const withFee = baseProject();
    withFee.sale.brokerFeePercent = 0.03;
    withFee.sale.brokerFeeFixed = 0;
    const withoutFee = baseProject();
    withoutFee.sale.brokerFeePercent = 0;
    withoutFee.sale.brokerFeeFixed = 0;

    const rWith = calculateScenario(withFee, "PRIVATE_EQUITY");
    const rWithout = calculateScenario(withoutFee, "PRIVATE_EQUITY");
    expect(rWith.profitAfterTax).toBeLessThan(rWithout.profitAfterTax);
  });

  it("defaults new projects to a non-zero broker fee estimate instead of a silent zero", () => {
    expect(defaultSale().brokerFeePercent).toBeGreaterThan(0);
  });

  it("solves a break-even sale price that yields roughly zero net profit", () => {
    const p = baseProject();
    const r = calculateScenario(p, "PRIVATE_EQUITY");
    expect(r.breakEven.breakEvenSalePrice).not.toBeNull();
    const atBreakEven = calculateScenario(p, "PRIVATE_EQUITY", {
      salePrice: r.breakEven.breakEvenSalePrice as number,
    });
    expect(Math.abs(atBreakEven.profitAfterTax)).toBeLessThan(2_000);
  });

  it("orders the ROI targets above the break-even price", () => {
    const r = calculateScenario(baseProject(), "PRIVATE_EQUITY");
    const be = r.breakEven;
    expect(be.salePriceFor10PctROI as number).toBeGreaterThan(be.breakEvenSalePrice as number);
    expect(be.salePriceFor20PctROI as number).toBeGreaterThan(be.salePriceFor10PctROI as number);
    expect(be.salePriceFor30PctROI as number).toBeGreaterThan(be.salePriceFor20PctROI as number);
  });

  it("survives a project with no purchase or sale price entered", () => {
    const blank = createBlankProject("blank", "Blank");
    const results = calculateAllScenarios(blank);
    for (const r of results) {
      expect(Number.isFinite(r.totalProjectCost)).toBe(true);
      expect(Number.isFinite(r.profitAfterTax)).toBe(true);
    }
    expect(results[0].riskFlags.map((f) => f.id)).toContain("sale_price_missing");
  });

  it("shows the cost of extracting private capital from the company", () => {
    const p = baseProject();
    p.scenarios.PRIVATE_EQUITY.privateFunding.targetNetDividend = 500_000;
    p.scenarios.PRIVATE_EQUITY.dividend.availableLowTaxAllowance = 200_000;
    p.scenarios.PRIVATE_EQUITY.dividend.dividendTaxAboveAllowance = 0.5;
    const withExtraction = calculateScenario(p, "PRIVATE_EQUITY");

    const p2 = baseProject();
    const withoutExtraction = calculateScenario(p2, "PRIVATE_EQUITY");

    expect(withExtraction.totalProjectCost).toBeGreaterThan(withoutExtraction.totalProjectCost);
    expect(withExtraction.dividend?.dividendTax).toBeGreaterThan(0);
  });

  it("responds monotonically to the sale price", () => {
    const p = baseProject();
    const low = calculateScenario(p, "PRIVATE_EQUITY", { salePrice: 5_000_000 });
    const high = calculateScenario(p, "PRIVATE_EQUITY", { salePrice: 7_000_000 });
    expect(high.profitAfterTax).toBeGreaterThan(low.profitAfterTax);
  });
});

describe("sensitivity", () => {
  it("builds a 3x3 matrix", () => {
    const m = buildSensitivityMatrix({
      project: baseProject(),
      scenario: "PRIVATE_EQUITY",
      metric: "after_tax_profit",
    });
    expect(m.rows).toHaveLength(3);
    expect(m.columns).toHaveLength(3);
    expect(m.cells.flat()).toHaveLength(9);
  });

  it("gets worse with more renovation and better with a higher sale price", () => {
    const m = buildSensitivityMatrix({
      project: baseProject(),
      scenario: "PRIVATE_EQUITY",
      metric: "after_tax_profit",
    });
    expect(m.cells[0][1].value).toBeGreaterThan(m.cells[2][1].value);
    expect(m.cells[1][2].value).toBeGreaterThan(m.cells[1][0].value);
  });
});

describe("advisor questions", () => {
  it("asks private and company questions for a mixed comparison", () => {
    const qs = buildAdvisorQuestions(baseProject(), [
      "PRIVATE_EQUITY",
      "EXISTING_COMPANY",
    ]);
    const ids = qs.map((q) => q.id);
    expect(ids).toContain("private_residence_qualification");
    // Momsfrågan är inte längre en generisk rad, utan följer av hur projektet
    // ska drivas. Är användningen inte ifylld är det den frågan som ställs.
    expect(ids).toContain("vat_use_unknown");
  });
});

describe("break-even for company ownership", () => {
  it("lands where the company result after tax is zero, not at an arbitrary point", () => {
    const p = baseProject();
    const r = calculateScenario(p, "EXISTING_COMPANY");
    const be = r.breakEven.breakEvenSalePrice as number;
    expect(be).not.toBeNull();

    const atBreakEven = calculateScenario(p, "EXISTING_COMPANY", { salePrice: be });
    expect(Math.abs(atBreakEven.profitAfterTax)).toBeLessThan(2_000);
  });

  it("puts the company break-even above the money already sunk into the project", () => {
    const p = baseProject();
    const r = calculateScenario(p, "EXISTING_COMPANY");
    const be = r.breakEven.breakEvenSalePrice as number;
    // Sunk cost is at least the purchase price plus stamp duty and renovation.
    expect(be).toBeGreaterThan(r.purchasePrice + r.purchaseTaxesFees);
  });

  it("is not fooled by owner net cash being clamped at zero below break-even", () => {
    const p = baseProject();
    const below = calculateScenario(p, "EXISTING_COMPANY", { salePrice: 3_000_000 });
    // Owner-level cash cannot go negative — you cannot distribute a loss …
    expect(below.netAvailablePrivately).toBe(0);
    // … but the project result must, or the solver has nothing to bracket.
    expect(below.profitAfterTax).toBeLessThan(0);
  });
});

describe("unknown owner-level extraction tax", () => {
  it("flags a company scenario whose profit exceeds the allowance with no rate supplied", () => {
    const p = baseProject();
    p.scenarios.EXISTING_COMPANY.dividend.availableLowTaxAllowance = 100_000;
    p.scenarios.EXISTING_COMPANY.dividend.dividendTaxAboveAllowance = null;
    const r = calculateScenario(p, "EXISTING_COMPANY");
    expect(r.extraction?.aboveDividendAllowance).toBeGreaterThan(0);
    expect(r.extractionRateUnknown).toBe(true);
  });

  it("clears the flag once a rate above the allowance is supplied", () => {
    const p = baseProject();
    p.scenarios.EXISTING_COMPANY.dividend.availableLowTaxAllowance = 100_000;
    p.scenarios.EXISTING_COMPANY.dividend.dividendTaxAboveAllowance = 0.5;
    const r = calculateScenario(p, "EXISTING_COMPANY");
    expect(r.extractionRateUnknown).toBe(false);
    expect(r.netAvailablePrivately).toBeLessThan(r.netRetainedInCompany);
  });

  it("never marks private ownership as extraction-unknown", () => {
    const r = calculateScenario(baseProject(), "PRIVATE_EQUITY");
    expect(r.extractionRateUnknown).toBe(false);
  });

  it("does not crown a structure whose private outcome is unknown", () => {
    const p = baseProject();
    p.scenarios.EXISTING_COMPANY.dividend.availableLowTaxAllowance = 0;
    const results = calculateAllScenarios(p);
    const best = bestScenarioIndex(results, "max_family_net_worth");
    expect(best).toBeGreaterThanOrEqual(0);
    expect(results[best].extractionRateUnknown).toBe(false);
  });

  it("reports no winner when every scenario is unassessable", () => {
    const blank = createBlankProject("blank2", "Blank");
    const results = calculateAllScenarios(blank);
    expect(bestScenarioIndex(results, "max_family_net_worth")).toBe(-1);
  });
});
