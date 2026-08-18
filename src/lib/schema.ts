import { z } from "zod";
import { SCHEMA_VERSION } from "./defaults";

const nullableNumber = z.number().nullable();

const factsSchema = z.object({
  address: z.string().optional(),
  municipality: z.string().optional(),
  propertyDesignation: z.string().optional(),
  propertyType: z.enum([
    "detached_house",
    "townhouse",
    "holiday_home",
    "apartment",
    "commercial",
    "other",
  ]),
  tenure: z.enum(["freehold", "leasehold", "condominium", "other"]).optional(),
  constructionYear: nullableNumber.optional(),
  livingAreaSqm: nullableNumber.optional(),
  ancillaryAreaSqm: nullableNumber.optional(),
  plotAreaSqm: nullableNumber.optional(),
  taxAssessmentType: z.string().nullable().optional(),
  structureNotes: z.string().optional(),
  siteNotes: z.string().optional(),
  notes: z.string().optional(),
});

const inputsSchema = z.object({
  purchasePrice: nullableNumber,
  priorYearTaxAssessmentValue: nullableNumber,
  existingMortgageDeeds: nullableNumber,
  expectedSalePrice: nullableNumber,
  holdingPeriodMonths: z.number(),
  acquisitionDate: z.string().nullable().optional(),
  saleDate: z.string().nullable().optional(),
  ownershipSharePerson1: z.number(),
  ownershipSharePerson2: z.number(),
});

const scenarioSchema = z.object({
  type: z.enum(["PRIVATE_EQUITY", "PRIVATE_DEBT", "EXISTING_COMPANY", "PROJECT_COMPANY"]),
  enabled: z.boolean(),
  ownerKind: z.enum(["PRIVATE", "EXISTING_COMPANY", "PROJECT_COMPANY"]),
  privateFunding: z.object({
    existingPrivateCash: z.number(),
    targetNetDividend: z.number(),
    targetNetSalary: z.number(),
  }),
  privateLoans: z.object({
    mortgageAmount: z.number(),
    mortgageInterestRate: z.number(),
    mortgageSetupFee: z.number(),
    mortgageAmortizationAnnual: z.number(),
    unsecuredLoanAmount: z.number(),
    unsecuredInterestRate: z.number(),
    unsecuredSetupFee: z.number(),
    unsecuredAmortizationAnnual: z.number(),
    securedLoanInterestDeductionRate: z.number(),
    unsecuredLoanInterestDeductionRate: z.number(),
  }),
  dividend: z.object({
    availableLowTaxAllowance: z.number(),
    dividendTaxWithinAllowance: z.number(),
    dividendTaxAboveAllowance: nullableNumber,
  }),
  salary: z.object({
    effectiveMarginalIncomeTaxRate: z.number(),
    employerContributionRate: z.number(),
  }),
  companyFunding: z.object({
    companyCashInvested: z.number(),
    externalBusinessLoan: z.number(),
    businessInterestRate: z.number(),
    setupFee: z.number(),
    guaranteeFee: z.number(),
    amortizationAnnual: z.number(),
    deductibleInterestPercent: z.number(),
    personalGuarantee: z.boolean(),
  }),
  projectCompanyFunding: z.object({
    shareCapital: z.number(),
    shareholderContribution: z.number(),
    intercompanyLoan: z.number(),
    intercompanyInterestRate: z.number(),
    externalLoan: z.number(),
    externalInterestRate: z.number(),
    annualAccountingCost: z.number(),
    annualBankingCost: z.number(),
    annualAdminCost: z.number(),
  }),
  vat: z.object({
    vatTreatment: z.enum(["none", "partial", "full"]),
    vatDeductiblePercent: z.number(),
    lines: z.array(
      z.object({
        id: z.string(),
        label: z.string(),
        grossAmount: z.number(),
        vatRate: z.number(),
        deductiblePercent: z.number(),
      }),
    ),
  }),
  rot: z.object({
    enabled: z.boolean(),
    eligibleLaborCostGross: z.number(),
    eligibleOwners: z.number(),
    remainingAllowancePerson1: z.number(),
    remainingAllowancePerson2: z.number(),
  }),
  privateUseLevel: z.enum(["none", "occasional", "frequent", "full_disposition"]),
  benefit: z.object({
    estimatedAnnualMarketBenefitValue: z.number(),
    ownerIncomeTaxRateOnBenefit: z.number(),
    employerContributionRate: z.number(),
  }),
  privatePropertyTaxClassification: z.enum([
    "private_residential_property",
    "business_property",
    "property_trading_inventory_risk",
  ]),
  companyAssetClassification: z.enum(["capital_asset", "inventory_property"]),
  improvementBasis: z.object({
    fundamentalImprovementsPercent: z.number(),
    qualifyingRepairsAndMaintenancePercent: z.number(),
    nonDeductiblePercent: z.number(),
  }),
  opportunityCost: z.object({
    annualAlternativeReturnRate: z.number(),
  }),
  flipIntent: z.boolean(),
  classificationConfirmedByAdvisor: z.boolean(),
});

export const projectSchema = z.object({
  schemaVersion: z.number(),
  id: z.string(),
  name: z.string(),
  status: z.enum(["draft", "active", "renovation", "for_sale", "sold", "archived"]),
  archived: z.boolean(),
  currency: z.literal("SEK"),
  createdAt: z.string(),
  updatedAt: z.string(),
  facts: factsSchema,
  inputs: inputsSchema,
  renovation: z.record(z.string(), z.union([z.number(), z.string()])),
  operatingCosts: z.record(z.string(), nullableNumber),
  rental: z.object({
    enabled: z.boolean(),
    rentedWeeks: z.number(),
    rentPerWeek: z.number(),
    platformFeePercent: z.number(),
    cleaningPerStay: z.number(),
    numberOfStays: z.number(),
    extraUtilities: z.number(),
    extraWearAndTear: z.number(),
  }),
  sale: z.record(z.string(), z.number()),
  hiddenCosts: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      amount: z.number(),
      included: z.boolean(),
    }),
  ),
  scenarios: z.object({
    PRIVATE_EQUITY: scenarioSchema,
    PRIVATE_DEBT: scenarioSchema,
    EXISTING_COMPANY: scenarioSchema,
    PROJECT_COMPANY: scenarioSchema,
  }),
  compareScenarios: z.array(
    z.enum(["PRIVATE_EQUITY", "PRIVATE_DEBT", "EXISTING_COMPANY", "PROJECT_COMPANY"]),
  ),
  selectedScenario: z.enum([
    "PRIVATE_EQUITY",
    "PRIVATE_DEBT",
    "EXISTING_COMPANY",
    "PROJECT_COMPANY",
  ]),
  optimizationTarget: z.enum([
    "max_private_cash",
    "max_company_cash",
    "max_family_net_worth",
    "max_equity_roi",
    "min_peak_cash_required",
    "min_tax",
  ]),
  taxOverrides: z.record(z.string(), z.union([z.number(), z.string(), z.null()])),
  taxConfigSnapshot: z
    .object({
      taxYear: z.number(),
      sourceVersion: z.string(),
      lockedAt: z.string().optional(),
      values: z.record(z.string(), z.union([z.number(), z.null()])),
    })
    .nullable(),
  notes: z.string().optional(),
});

export const savedProjectFileSchema = z.object({
  schemaVersion: z.number(),
  exportedAt: z.string().optional(),
  projects: z.array(projectSchema),
});

export interface ImportIssue {
  projectName: string;
  path: string;
  message: string;
  severity: "error" | "warning";
}

export interface ImportReport {
  imported: number;
  skipped: number;
  issues: ImportIssue[];
}

export function currentSchemaVersion(): number {
  return SCHEMA_VERSION;
}
