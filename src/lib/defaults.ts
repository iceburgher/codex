import { DEFAULT_TAX_CONFIG_2026 } from "@/config/taxConfig";
import type {
  HiddenCostItem,
  OwnerKind,
  PropertyProject,
  RenovationInputs,
  RentalInputs,
  RunningCosts,
  SaleInputs,
  ScenarioInputs,
  ScenarioType,
} from "@/types";

export const SCHEMA_VERSION = 1;

export const ALL_SCENARIOS: ScenarioType[] = ["PRIVATE_EQUITY", "PRIVATE_DEBT", "EXISTING_COMPANY"];

export const HIDDEN_COST_TEMPLATE: Omit<HiddenCostItem, "amount" | "included">[] = [
  { id: "pre_purchase_inspection", label: "Besiktning före köp" },
  { id: "energy_certificate", label: "Energideklaration" },
  { id: "valuation", label: "Värdering" },
  { id: "legal_advice", label: "Juridisk rådgivning" },
  { id: "tax_advice", label: "Skatterådgivning" },
  { id: "bank_valuation", label: "Bankens värdering" },
  { id: "utility_connection", label: "Anslutningsavgifter" },
  { id: "temporary_electricity", label: "Byggström" },
  { id: "storage", label: "Magasinering" },
  { id: "temporary_accommodation", label: "Tillfälligt boende" },
  { id: "travel", label: "Resor till objektet" },
  { id: "construction_insurance", label: "Byggförsäkring" },
  { id: "insurance_deductibles", label: "Självrisker" },
  { id: "cleaning", label: "Städning" },
  { id: "photography", label: "Fotografering" },
  { id: "post_renovation_holding", label: "Kostnader efter renovering fram till försäljning" },
];

export function defaultHiddenCosts(): HiddenCostItem[] {
  return HIDDEN_COST_TEMPLATE.map((t) => ({ ...t, amount: 0, included: true }));
}

export function defaultRenovation(): RenovationInputs {
  return {
    laborGross: 0,
    materialsGross: 0,
    architect: 0,
    structuralEngineer: 0,
    buildingPermit: 0,
    controlManager: 0,
    inspection: 0,
    groundWorks: 0,
    demolition: 0,
    wasteAndContainers: 0,
    transport: 0,
    equipmentRental: 0,
    projectManagement: 0,
    appliances: 0,
    fixedInterior: 0,
    looseInterior: 0,
    styling: 0,
    landscaping: 0,
    other: 0,
    contingencyPercent: 0.15,
  };
}

export function defaultRunningCosts(): RunningCosts {
  return {
    electricityAnnual: 0,
    heatingAnnual: 0,
    waterSewerAnnual: 0,
    wasteAnnual: 0,
    internetAnnual: 0,
    insuranceAnnual: 0,
    propertyFeeAnnual: null,
    alarmAnnual: 0,
    landscapingAnnual: 0,
    snowRemovalAnnual: 0,
    repairsAnnual: 0,
    travelAnnual: 0,
    bookkeepingAnnual: 0,
    bankingAnnual: 0,
    securityAnnual: 0,
    otherAnnual: 0,
  };
}

export function defaultRental(): RentalInputs {
  return {
    enabled: false,
    rentedWeeks: 0,
    rentPerWeek: 0,
    platformFeePercent: 0,
    cleaningPerStay: 0,
    numberOfStays: 0,
    extraUtilities: 0,
    extraWearAndTear: 0,
  };
}

export function defaultSale(): SaleInputs {
  return {
    brokerFeeFixed: 0,
    // Uppskattning, inte ett kontrollerat pris — courtage varierar mellan
    // mäklare och orter. Byt ut mot en offert så fort ni har en.
    brokerFeePercent: 0.03,
    photography: 0,
    styling: 0,
    inspection: 0,
    sellerInsurance: 0,
    cleaning: 0,
    legal: 0,
    other: 0,
    priceNegotiationBufferRate: 0.03,
  };
}

function ownerKindFor(type: ScenarioType): OwnerKind {
  return type === "EXISTING_COMPANY" ? "EXISTING_COMPANY" : "PRIVATE";
}

export function defaultScenario(type: ScenarioType): ScenarioInputs {
  const isCompany = type === "EXISTING_COMPANY";
  const isDebtFunded = type === "PRIVATE_DEBT";

  return {
    type,
    enabled: true,
    ownerKind: ownerKindFor(type),

    privateFunding: {
      existingPrivateCash: 0,
      targetNetDividend: 0,
      targetNetSalary: 0,
    },
    privateLoans: {
      mortgageAmount: 0,
      mortgageInterestRate: isDebtFunded ? 0.045 : 0,
      mortgageSetupFee: 0,
      mortgageAmortizationAnnual: 0,
      unsecuredLoanAmount: 0,
      unsecuredInterestRate: isDebtFunded ? 0.09 : 0,
      unsecuredSetupFee: 0,
      unsecuredAmortizationAnnual: 0,
      securedLoanInterestDeductionRate:
        DEFAULT_TAX_CONFIG_2026.securedLoanInterestDeductionRateDefault,
      unsecuredLoanInterestDeductionRate: DEFAULT_TAX_CONFIG_2026.unsecuredLoanInterestDeductionRate,
    },
    dividend: {
      availableLowTaxAllowance: 0,
      dividendTaxWithinAllowance: DEFAULT_TAX_CONFIG_2026.dividendTaxWithinAllowance,
      dividendTaxAboveAllowance: null,
    },
    salary: {
      effectiveMarginalIncomeTaxRate: 0,
      employerContributionRate: DEFAULT_TAX_CONFIG_2026.employerContributionRate,
    },

    companyFunding: {
      companyCashInvested: 0,
      externalBusinessLoan: 0,
      businessInterestRate: isCompany ? 0.055 : 0,
      setupFee: 0,
      guaranteeFee: 0,
      amortizationAnnual: 0,
      deductibleInterestPercent: 1,
      personalGuarantee: false,
    },
    vat: {
      vatTreatment: "none",
      vatDeductiblePercent: 0,
      lines: [],
      buildWorkBy: "unknown",
      intendedUse: "unknown",
      voluntaryTaxLiability: "unknown",
    },
    rot: {
      enabled: !isCompany,
      eligibleLaborCostGross: 0,
      eligibleOwners: 2,
      remainingAllowancePerson1: isCompany ? 0 : DEFAULT_TAX_CONFIG_2026.rotMaxPerPerson,
      remainingAllowancePerson2: isCompany ? 0 : DEFAULT_TAX_CONFIG_2026.rotMaxPerPerson,
    },

    privateUseLevel: "none",
    benefit: {
      estimatedAnnualMarketBenefitValue: 0,
      ownerIncomeTaxRateOnBenefit: 0,
      employerContributionRate: DEFAULT_TAX_CONFIG_2026.employerContributionRate,
    },

    privatePropertyTaxClassification: "property_trading_inventory_risk",
    companyAssetClassification: "capital_asset",
    improvementBasis: {
      fundamentalImprovementsPercent: 0,
      qualifyingRepairsAndMaintenancePercent: 0,
      nonDeductiblePercent: 1,
    },

    opportunityCost: {
      annualAlternativeReturnRate: 0,
    },

    flipIntent: false,
    classificationConfirmedByAdvisor: false,
  };
}

export function defaultScenarios(): Record<ScenarioType, ScenarioInputs> {
  return {
    PRIVATE_EQUITY: defaultScenario("PRIVATE_EQUITY"),
    PRIVATE_DEBT: defaultScenario("PRIVATE_DEBT"),
    EXISTING_COMPANY: defaultScenario("EXISTING_COMPANY"),
  };
}

export function createBlankProject(id: string, name = "Nytt projekt"): PropertyProject {
  const now = new Date().toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    id,
    name,
    status: "draft",
    archived: false,
    currency: "SEK",
    createdAt: now,
    updatedAt: now,
    facts: {
      propertyType: "detached_house",
      tenure: "freehold",
      constructionYear: null,
      livingAreaSqm: null,
      ancillaryAreaSqm: null,
      plotAreaSqm: null,
      taxAssessmentType: null,
    },
    inputs: {
      purchasePrice: null,
      priorYearTaxAssessmentValue: null,
      existingMortgageDeeds: null,
      expectedSalePrice: null,
      holdingPeriodMonths: 12,
      acquisitionDate: null,
      saleDate: null,
      ownershipSharePerson1: 0.5,
      ownershipSharePerson2: 0.5,
    },
    renovation: defaultRenovation(),
    operatingCosts: defaultRunningCosts(),
    rental: defaultRental(),
    sale: defaultSale(),
    hiddenCosts: defaultHiddenCosts(),
    scenarios: defaultScenarios(),
    // Lån behövs i praktiken oavsett ägarform, så jämförelsen börjar med de
    // två realistiska alternativen. Övriga går att slå på under Antaganden.
    compareScenarios: ["PRIVATE_DEBT", "EXISTING_COMPANY"],
    selectedScenario: "PRIVATE_DEBT",
    optimizationTarget: "max_family_net_worth",
    taxOverrides: {},
    taxConfigSnapshot: null,
  };
}
