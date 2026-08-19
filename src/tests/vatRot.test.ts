import { describe, expect, it } from "vitest";
import { RESIDENTIAL_VAT_WARNING, calculateVat, calculateVatLine, extractVat } from "@/calculations/vat";
import { calculateRot } from "@/calculations/rot";
import { calculateImprovementBasis } from "@/calculations/improvementBasis";
import type { RotInputs, VatInputs } from "@/types";

/** Momsfrågorna om hur projektet drivs påverkar inte själva uträkningen. */
function vat(overrides: Partial<VatInputs> = {}): VatInputs {
  return {
    vatTreatment: "none",
    vatDeductiblePercent: 0,
    lines: [],
    buildWorkBy: "unknown",
    intendedUse: "unknown",
    voluntaryTaxLiability: "unknown",
    ...overrides,
  };
}

const noVat: VatInputs = vat();

describe("VAT extraction", () => {
  it("extracts 25% VAT from a gross amount", () => {
    expect(extractVat(125_000, 0.25)).toBeCloseTo(25_000, 6);
  });

  it("returns zero VAT at a zero rate", () => {
    expect(extractVat(100_000, 0)).toBe(0);
  });

  it("computes deductible VAT and true cash cost per line", () => {
    const r = calculateVatLine(125_000, 0.25, 0.5);
    expect(r.vatIncluded).toBeCloseTo(25_000, 6);
    expect(r.deductibleVat).toBeCloseTo(12_500, 6);
    expect(r.trueCashCost).toBeCloseTo(112_500, 6);
  });
});

describe("VAT module", () => {
  it("defaults residential renovation to zero deductible VAT", () => {
    const r = calculateVat({
      renovationTotalGross: 1_000_000,
      vat: noVat,
      defaultVatRate: 0.25,
      isCompanyOwned: true,
    });
    expect(r.deductibleVat).toBe(0);
    expect(r.trueCashCost).toBe(1_000_000);
    expect(r.nonDeductibleVat).toBeCloseTo(200_000, 6);
    expect(r.warning).toBeUndefined();
  });

  it("warns when a company scenario claims VAT deduction", () => {
    const r = calculateVat({
      renovationTotalGross: 1_000_000,
      vat: vat({ vatTreatment: "full", vatDeductiblePercent: 1 }),
      defaultVatRate: 0.25,
      isCompanyOwned: true,
    });
    expect(r.deductibleVat).toBeCloseTo(200_000, 6);
    expect(r.trueCashCost).toBeCloseTo(800_000, 6);
    expect(r.warning).toBe(RESIDENTIAL_VAT_WARNING);
  });

  it("applies line-level overrides before the scenario default", () => {
    const r = calculateVat({
      renovationTotalGross: 1_000_000,
      vat: vat({
        lines: [
          { id: "l1", label: "Commercial part", grossAmount: 250_000, vatRate: 0.25, deductiblePercent: 1 },
        ],
      }),
      defaultVatRate: 0.25,
      isCompanyOwned: true,
    });
    expect(r.deductibleVat).toBeCloseTo(50_000, 6);
    expect(r.trueCashCost).toBeCloseTo(950_000, 6);
  });
});

describe("ROT", () => {
  const rot: RotInputs = {
    enabled: true,
    eligibleLaborCostGross: 400_000,
    eligibleOwners: 2,
    remainingAllowancePerson1: 50_000,
    remainingAllowancePerson2: 50_000,
  };

  it("caps the credit at the combined per-person allowance", () => {
    const r = calculateRot({
      rot,
      renovationTotalGross: 1_000_000,
      rotRate: 0.3,
      rotMaxPerPerson: 50_000,
      isPrivateOwned: true,
    });
    expect(r.potentialRot).toBe(120_000);
    expect(r.availableRotAllowance).toBe(100_000);
    expect(r.rotDeduction).toBe(100_000);
    expect(r.privateRenovationCashCost).toBe(900_000);
  });

  it("gives the full 30% when it stays under the allowance", () => {
    const r = calculateRot({
      rot: { ...rot, eligibleLaborCostGross: 200_000 },
      renovationTotalGross: 1_000_000,
      rotRate: 0.3,
      rotMaxPerPerson: 50_000,
      isPrivateOwned: true,
    });
    expect(r.rotDeduction).toBe(60_000);
  });

  it("is unavailable to company ownership", () => {
    const r = calculateRot({
      rot,
      renovationTotalGross: 1_000_000,
      rotRate: 0.3,
      rotMaxPerPerson: 50_000,
      isPrivateOwned: false,
    });
    expect(r.rotDeduction).toBe(0);
    expect(r.privateRenovationCashCost).toBe(1_000_000);
  });

  it("returns zero when disabled or with no eligible labour", () => {
    const disabled = calculateRot({
      rot: { ...rot, enabled: false },
      renovationTotalGross: 0,
      rotRate: 0.3,
      rotMaxPerPerson: 50_000,
      isPrivateOwned: true,
    });
    expect(disabled.rotDeduction).toBe(0);

    const noLabour = calculateRot({
      rot: { ...rot, eligibleLaborCostGross: 0 },
      renovationTotalGross: 500_000,
      rotRate: 0.3,
      rotMaxPerPerson: 50_000,
      isPrivateOwned: true,
    });
    expect(noLabour.rotDeduction).toBe(0);
  });
});

describe("improvement tax basis", () => {
  it("excludes ROT-funded spend from the eligible basis", () => {
    const r = calculateImprovementBasis({
      renovationTotalGross: 1_000_000,
      rotDeduction: 100_000,
      split: {
        fundamentalImprovementsPercent: 1,
        qualifyingRepairsAndMaintenancePercent: 0,
        nonDeductiblePercent: 0,
      },
    });
    expect(r.eligibleTaxBasis).toBe(900_000);
    expect(r.nonEligibleRenovation).toBe(100_000);
  });

  it("never assumes all renovation is deductible", () => {
    const r = calculateImprovementBasis({
      renovationTotalGross: 1_000_000,
      rotDeduction: 0,
      split: {
        fundamentalImprovementsPercent: 0,
        qualifyingRepairsAndMaintenancePercent: 0,
        nonDeductiblePercent: 1,
      },
    });
    expect(r.eligibleTaxBasis).toBe(0);
  });

  it("counts qualifying repairs and maintenance toward the eligible basis, not just fundamental improvements", () => {
    // This is the bucket that was previously wired to nothing — a
    // renovate-and-sell project's repair spend (repainting, new surfaces,
    // fixing up rooms) is exactly what this category is for, and skipping it
    // was silently inflating the private capital-gains tax basis.
    const r = calculateImprovementBasis({
      renovationTotalGross: 1_000_000,
      rotDeduction: 0,
      split: {
        fundamentalImprovementsPercent: 0.3,
        qualifyingRepairsAndMaintenancePercent: 0.5,
        nonDeductiblePercent: 0.2,
      },
    });
    expect(r.fundamentalImprovements).toBe(300_000);
    expect(r.qualifyingRepairs).toBe(500_000);
    expect(r.eligibleTaxBasis).toBe(800_000);
    expect(r.nonEligibleRenovation).toBe(200_000);
    expect(r.splitWarning).toBeUndefined();
  });

  it("warns when the three shares do not add up to the whole renovation", () => {
    const r = calculateImprovementBasis({
      renovationTotalGross: 1_000_000,
      rotDeduction: 0,
      split: {
        fundamentalImprovementsPercent: 0.3,
        qualifyingRepairsAndMaintenancePercent: 0.3,
        nonDeductiblePercent: 0.2, // sums to 0.8, not 1
      },
    });
    expect(r.splitWarning).toBeDefined();
  });
});
