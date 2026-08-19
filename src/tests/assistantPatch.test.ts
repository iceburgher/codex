import { describe, expect, it } from "vitest";
import { applyAssistantPatch } from "@/lib/assistantPatch";
import { createBlankProject } from "@/lib/defaults";

describe("applyAssistantPatch", () => {
  it("uppdaterar ett känt fält på toppnivå", () => {
    const p = createBlankProject("p1");
    const { changed } = applyAssistantPatch(p, { inputs: { purchasePrice: 3_600_000 } });
    expect(p.inputs.purchasePrice).toBe(3_600_000);
    expect(changed).toEqual(["inputs.purchasePrice"]);
  });

  it("fyller i ett belopp som från början står som null", () => {
    const p = createBlankProject("p1");
    expect(p.inputs.expectedSalePrice).toBeNull();
    applyAssistantPatch(p, { inputs: { expectedSalePrice: 5_200_000 } });
    expect(p.inputs.expectedSalePrice).toBe(5_200_000);
  });

  it("skriver aldrig en sträng i ett belopp som står som null", () => {
    const p = createBlankProject("p1");
    applyAssistantPatch(p, { inputs: { expectedSalePrice: "fem miljoner" } });
    expect(p.inputs.expectedSalePrice).toBeNull();
  });

  it("uppdaterar ett fält djupt nere i en specifik scenariotyp", () => {
    const p = createBlankProject("p1");
    applyAssistantPatch(p, {
      scenarios: { PRIVATE_DEBT: { privateLoans: { mortgageAmount: 3_000_000 } } },
    });
    expect(p.scenarios.PRIVATE_DEBT.privateLoans.mortgageAmount).toBe(3_000_000);
    // Andra scenarier ska inte påverkas av en patch riktad mot ett annat.
    expect(p.scenarios.PRIVATE_EQUITY.privateLoans.mortgageAmount).toBe(0);
  });

  it("ignorerar fält som inte finns i projektet i stället för att lägga till dem", () => {
    const p = createBlankProject("p1");
    const before = JSON.stringify(p);
    const { changed } = applyAssistantPatch(p, {
      inputs: { madeUpField: 123 },
      totallyUnknownTopLevelKey: "hack",
    });
    expect(changed).toEqual([]);
    expect(JSON.stringify(p)).toBe(before);
  });

  it("rör aldrig listor som hiddenCosts eller compareScenarios", () => {
    const p = createBlankProject("p1");
    const before = [...p.compareScenarios];
    applyAssistantPatch(p, { compareScenarios: ["PRIVATE_EQUITY"] });
    expect(p.compareScenarios).toEqual(before);
  });

  it("skriver aldrig in fel typ på ett befintligt fält", () => {
    const p = createBlankProject("p1");
    applyAssistantPatch(p, { inputs: { purchasePrice: "tre miljoner" } });
    expect(p.inputs.purchasePrice).toBeNull();
  });

  it("uppdaterar uthyrning från ett naturligt-språk-liknande förslag", () => {
    const p = createBlankProject("p1");
    applyAssistantPatch(p, {
      rental: { enabled: true, rentedWeeks: 8, rentPerWeek: 5769 },
    });
    expect(p.rental.enabled).toBe(true);
    expect(p.rental.rentedWeeks).toBe(8);
    expect(p.rental.rentPerWeek).toBe(5769);
  });

  it("fyller i objektfakta som tomtarea och kommun på ett helt nytt, orört projekt", () => {
    // Dessa fält saknas helt tills prospektimporten eller användaren själv
    // fyller i dem — de får inte se ut som att de "inte finns" bara för att
    // ett splitternytt projekt inte råkat sätta dem än.
    const p = createBlankProject("p1");
    applyAssistantPatch(p, {
      facts: { municipality: "Båstad", propertyDesignation: "Påarp 4:46", plotAreaSqm: 1881 },
    });
    expect(p.facts.municipality).toBe("Båstad");
    expect(p.facts.propertyDesignation).toBe("Påarp 4:46");
    expect(p.facts.plotAreaSqm).toBe(1881);
  });

  it("uppdaterar projektnamn och anteckningar", () => {
    const p = createBlankProject("p1");
    applyAssistantPatch(p, { name: "Påarpsvägen 165", notes: "Kräver dränering." });
    expect(p.name).toBe("Påarpsvägen 165");
    expect(p.notes).toBe("Kräver dränering.");
  });

  it("rör aldrig aiChat-historiken, bara de ekonomiska fälten", () => {
    const p = createBlankProject("p1");
    const before = [...p.aiChat];
    applyAssistantPatch(p, { aiChat: [{ role: "user", text: "hack", ts: "now" }] });
    expect(p.aiChat).toEqual(before);
  });
});
