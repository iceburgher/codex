import type { PropertyProject } from "@/types";
import { createBlankProject } from "@/lib/defaults";

/**
 * Example/starter project data only. This is a fixture: it is never referenced
 * by the calculation engine and can be deleted like any other project.
 */
export const SEED_PROJECT_ID = "seed-klockaregatan-4-torekov";

export function createSeedProject(): PropertyProject {
  const base = createBlankProject(SEED_PROJECT_ID, "Klockaregatan 4 — Torekov");

  const project: PropertyProject = {
    ...base,
    status: "draft",
    facts: {
      ...base.facts,
      address: "Klockaregatan 4, Torekov",
      municipality: "Båstads kommun",
      propertyDesignation: undefined,
      propertyType: "detached_house",
      tenure: "freehold",
      constructionYear: null,
      livingAreaSqm: null,
      ancillaryAreaSqm: null,
      plotAreaSqm: null,
      taxAssessmentType: null,
      structureNotes: "Betongstomme.",
      siteNotes:
        "Fastigheten ligger i Torekov. Tidigare projektanalys har även berört tomtgräns, närliggande Klockaregatan 2 samt detaljplan/bygglovsfrågor. Exakta rättsliga/tekniska data ska inte antas utan verifiering.",
    },
    inputs: {
      ...base.inputs,
      purchasePrice: 3_600_000,
      priorYearTaxAssessmentValue: null,
      existingMortgageDeeds: null,
      expectedSalePrice: null,
      holdingPeriodMonths: 12,
      ownershipSharePerson1: 0.5,
      ownershipSharePerson2: 0.5,
    },
    renovation: {
      ...base.renovation,
      other: 1_000_000,
      inspection: 5_000,
      contingencyPercent: 0.15,
      notes:
        "Basbudget för renovering: 1,0 MSEK. Fördela på rader först när offerter finns. Besiktning uppskattad till 5 000 kr enligt tidigare underlag.",
    },
    selectedScenario: "PRIVATE_DEBT",
    notes:
      "Objektet analyseras primärt som ett potentiellt renoverings- och försäljningsprojekt. Känd bas: köpeskilling cirka 3,6 MSEK och renoveringsbudget cirka 1,0 MSEK. Möjliga ägaralternativ: privat eller befintligt bolag. Syftet med kalkylatorn är att jämföra total efter-skatt-ekonomi och kapitalbehov, inte bara nominella skattesatser.",
  };

  // Intended use is renovate-and-sell with possible private use — recorded so
  // the classification risk flags fire rather than assuming a benign case.
  for (const type of ["PRIVATE_EQUITY", "PRIVATE_DEBT"] as const) {
    project.scenarios[type] = {
      ...project.scenarios[type],
      flipIntent: true,
      privateUseLevel: "occasional",
      privatePropertyTaxClassification: "property_trading_inventory_risk",
      // Illustrativ uppdelning av basbudgeten (1,0 MSEK) tills en faktisk
      // specifikation finns — annars ser demot ut som att hela renoveringen
      // är en förlustaffär, trots att det bara är avdragsunderlaget som
      // står på 0 kr som standard. Byt ut mot verkliga andelar när
      // renoveringen är specificerad rad för rad.
      improvementBasis: {
        fundamentalImprovementsPercent: 0.5,
        qualifyingRepairsAndMaintenancePercent: 0.3,
        nonDeductiblePercent: 0.2,
      },
    };
  }
  project.scenarios.EXISTING_COMPANY = {
    ...project.scenarios.EXISTING_COMPANY,
    flipIntent: true,
    privateUseLevel: "full_disposition",
  };

  project.scenarios.EXISTING_COMPANY = {
    ...project.scenarios.EXISTING_COMPANY,
    companyFunding: {
      ...project.scenarios.EXISTING_COMPANY.companyFunding,
      companyCashInvested: 1_800_000,
    },
  };

  return project;
}
