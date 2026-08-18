import { describe, expect, it } from "vitest";
import {
  calculateCompanyStampDuty,
  calculateNewMortgageDeedCost,
  calculatePrivateStampDuty,
  calculatePurchaseCosts,
  calculateStampDutyBase,
  calculateTitleCost,
} from "@/calculations/purchase";

describe("stamp duty base", () => {
  it("uses the higher of purchase price and tax assessment value", () => {
    expect(calculateStampDutyBase(3_600_000, 2_000_000)).toBe(3_600_000);
    expect(calculateStampDutyBase(3_600_000, 4_000_000)).toBe(4_000_000);
  });

  it("treats a missing tax assessment value as zero", () => {
    expect(calculateStampDutyBase(3_600_000, 0)).toBe(3_600_000);
  });
});

describe("private stamp duty", () => {
  it("applies 1.5% to the base", () => {
    expect(calculatePrivateStampDuty(3_600_000, 0, 0.015)).toBe(54_000);
  });

  it("adds the fixed registration fee for the title cost", () => {
    expect(calculateTitleCost(3_600_000, 0, 0.015, 825)).toBe(54_825);
  });

  it("returns zero for a zero-price purchase", () => {
    expect(calculatePrivateStampDuty(0, 0, 0.015)).toBe(0);
  });
});

describe("company stamp duty", () => {
  it("applies 4.25% to the base", () => {
    expect(calculateCompanyStampDuty(3_600_000, 0, 0.0425)).toBe(153_000);
  });

  it("matches the audit example: 153 000 + 825 = 153 825", () => {
    expect(calculateTitleCost(3_600_000, 0, 0.0425, 825)).toBe(153_825);
  });
});

describe("mortgage deeds", () => {
  it("charges 2% only on deeds beyond those that already exist", () => {
    const r = calculateNewMortgageDeedCost(3_000_000, 1_000_000, 0.02, 0);
    expect(r.requiredMortgageDeeds).toBe(2_000_000);
    expect(r.newMortgageDeedTax).toBe(40_000);
    expect(r.newMortgageDeedCost).toBe(40_000);
  });

  it("never goes negative when existing deeds exceed the debt", () => {
    const r = calculateNewMortgageDeedCost(500_000, 1_000_000, 0.02, 375);
    expect(r.requiredMortgageDeeds).toBe(0);
    expect(r.newMortgageDeedTax).toBe(0);
    expect(r.newMortgageDeedCost).toBe(375);
  });

  it("handles zero debt", () => {
    const r = calculateNewMortgageDeedCost(0, 0, 0.02, 0);
    expect(r.newMortgageDeedCost).toBe(0);
  });
});

describe("purchase cost aggregation", () => {
  const base = {
    purchasePrice: 3_600_000,
    priorYearTaxAssessmentValue: 0,
    existingMortgageDeeds: 0,
    securedDebt: 0,
    privateStampDutyRate: 0.015,
    companyStampDutyRate: 0.0425,
    titleRegistrationFee: 825,
    mortgageDeedTaxRate: 0.02,
    mortgageDeedAdminFee: 0,
  };

  it("costs a company acquisition materially more than a private one", () => {
    const priv = calculatePurchaseCosts({ ...base, isCompanyOwned: false });
    const comp = calculatePurchaseCosts({ ...base, isCompanyOwned: true });
    expect(priv.totalPurchaseCosts).toBe(54_825);
    expect(comp.totalPurchaseCosts).toBe(153_825);
    expect(comp.totalPurchaseCosts - priv.totalPurchaseCosts).toBe(99_000);
  });

  it("includes new mortgage deed cost when debt is secured", () => {
    const r = calculatePurchaseCosts({
      ...base,
      isCompanyOwned: false,
      securedDebt: 2_000_000,
    });
    expect(r.newMortgageDeedTax).toBe(40_000);
    expect(r.totalPurchaseCosts).toBe(54_825 + 40_000);
  });
});
