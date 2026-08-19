import { describe, expect, it } from "vitest";
import { vatQuestions, vatRiskFlags } from "@/calculations/vatGuidance";
import { defaultScenario } from "@/lib/defaults";
import type { ScenarioInputs, VatInputs } from "@/types";

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

function company(overrides: Partial<VatInputs> = {}): ScenarioInputs {
  return { ...defaultScenario("EXISTING_COMPANY"), vat: vat(overrides) };
}

describe("momsfrågor", () => {
  it("frågar vad huset ska användas till när det inte är ifyllt", () => {
    expect(vatQuestions(vat()).map((q) => q.id)).toContain("vat_use_unknown");
  });

  it("ber om bekräftelse på att avdrag saknas vid bostad", () => {
    const ids = vatQuestions(vat({ intendedUse: "sell_residential" })).map((q) => q.id);
    expect(ids).toContain("vat_residential_exempt");
    expect(ids).not.toContain("vat_voluntary_liability");
  });

  it("tar upp frivillig skattskyldighet först vid lokal", () => {
    const ids = vatQuestions(vat({ intendedUse: "rent_commercial" })).map((q) => q.id);
    expect(ids).toContain("vat_voluntary_liability");
  });

  it("frågar om fördelning vid blandad användning", () => {
    const ids = vatQuestions(vat({ intendedUse: "mixed" })).map((q) => q.id);
    expect(ids).toContain("vat_mixed_split");
  });

  it("frågar om uttagsbeskattning när bolaget bygger i egen regi", () => {
    const ids = vatQuestions(vat({ buildWorkBy: "own_staff" })).map((q) => q.id);
    expect(ids).toContain("vat_own_staff");
    expect(ids).not.toContain("vat_reverse_charge");
  });

  it("frågar om omvänd byggmoms när hantverkare anlitas", () => {
    const ids = vatQuestions(vat({ buildWorkBy: "contractors" })).map((q) => q.id);
    expect(ids).toContain("vat_reverse_charge");
  });

  it("varje fråga bär med sig varför den ställs", () => {
    for (const q of vatQuestions(vat({ intendedUse: "mixed", buildWorkBy: "own_staff" }))) {
      expect(q.because.length).toBeGreaterThan(10);
    }
  });
});

describe("momsflaggor", () => {
  it("flaggar avdrag när huset ska säljas som bostad", () => {
    const flags = vatRiskFlags(
      company({ vatTreatment: "full", vatDeductiblePercent: 1, intendedUse: "sell_residential" }),
      "EXISTING_COMPANY",
    );
    expect(flags.map((f) => f.id)).toContain("vat_deduction_on_residential_use");
    expect(flags.find((f) => f.id === "vat_deduction_on_residential_use")?.severity).toBe("high");
  });

  it("flaggar avdrag på lokal utan frivillig skattskyldighet", () => {
    const flags = vatRiskFlags(
      company({ vatTreatment: "full", vatDeductiblePercent: 1, intendedUse: "rent_commercial" }),
      "EXISTING_COMPANY",
    );
    expect(flags.map((f) => f.id)).toContain("vat_deduction_without_voluntary_liability");
  });

  it("släpper igenom avdrag på lokal när skattskyldigheten är på plats", () => {
    const flags = vatRiskFlags(
      company({
        vatTreatment: "full",
        vatDeductiblePercent: 1,
        intendedUse: "rent_commercial",
        voluntaryTaxLiability: "yes",
      }),
      "EXISTING_COMPANY",
    );
    expect(flags.map((f) => f.id)).not.toContain("vat_deduction_without_voluntary_liability");
  });

  it("påminner om uttagsbeskattning vid eget byggarbete", () => {
    const flags = vatRiskFlags(company({ buildWorkBy: "own_staff" }), "EXISTING_COMPANY");
    expect(flags.map((f) => f.id)).toContain("vat_own_staff_self_supply");
  });

  it("nämner att avdrag kan finnas när kalkylen räknar utan, vid lokal", () => {
    const flags = vatRiskFlags(company({ intendedUse: "rent_commercial" }), "EXISTING_COMPANY");
    const flag = flags.find((f) => f.id === "vat_possible_deduction_unused");
    expect(flag?.severity).toBe("low");
  });

  it("lämnar privat ägande utan momsflaggor", () => {
    const scenario: ScenarioInputs = {
      ...defaultScenario("PRIVATE_DEBT"),
      vat: vat({ vatTreatment: "full", vatDeductiblePercent: 1, intendedUse: "sell_residential" }),
    };
    expect(vatRiskFlags(scenario, "PRIVATE_DEBT")).toEqual([]);
  });

  it("drar aldrig slutsatsen att avdrag medges", () => {
    // Ingen kombination av svar får ändra själva momsen — bara vad som flaggas.
    const flags = vatRiskFlags(
      company({ intendedUse: "rent_commercial", voluntaryTaxLiability: "yes" }),
      "EXISTING_COMPANY",
    );
    expect(flags.every((f) => f.severity !== "high")).toBe(true);
  });
});
