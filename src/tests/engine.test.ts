import { describe, expect, it } from "vitest";
import { calculateAllScenarios, calculateScenario } from "@/calculations/engine";
import { buildSensitivityMatrix } from "@/calculations/sensitivity";
import { buildAdvisorQuestions } from "@/calculations/advisorQuestions";
import { createBlankProject } from "@/lib/defaults";
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
  p.scenarios.PROJECT_COMPANY.projectCompanyFunding.shareholderContribution = 1_800_000;
  p.scenarios.PROJECT_COMPANY.projectCompanyFunding.externalLoan = 3_000_000;
  return p;
}

describe("scenario engine", () => {
  it("produces a result for every compared scenario", () => {
    const results = calculateAllScenarios(baseProject());
    expect(results).toHaveLength(4);
    expect(results.map((r) => r.scenario)).toEqual([
      "PRIVATE_EQUITY",
      "PRIVATE_DEBT",
      "EXISTING_COMPANY",
      "PROJECT_COMPANY",
    ]);
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

  it("flags an unconfirmed private residential classification", () => {
    const p = baseProject();
    p.scenarios.PRIVATE_EQUITY.privatePropertyTaxClassification = "private_residential_property";
    const r = calculateScenario(p, "PRIVATE_EQUITY");
    expect(r.riskFlags.map((f) => f.id)).toContain(
      "private_residence_classification_unconfirmed",
    );
  });

  it("flags private use of a company-owned property", () => {
    const p = baseProject();
    p.scenarios.EXISTING_COMPANY.privateUseLevel = "full_disposition";
    const r = calculateScenario(p, "EXISTING_COMPANY");
    expect(r.riskFlags.map((f) => f.id)).toContain("company_private_use_risk");
    expect(r.warnings.map((w) => w.id)).toContain("benefit");
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
    expect(ids).toContain("vat_deductibility");
  });
});
