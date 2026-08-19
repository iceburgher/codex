/**
 * Core domain types for the reusable Swedish property investment calculator.
 * These types are intentionally generic: nothing here may reference a specific
 * property, address or price. See spec section 35 ("Critical Implementation Rule").
 */

export type Currency = "SEK";

export type PropertyType =
  | "detached_house"
  | "townhouse"
  | "holiday_home"
  | "apartment"
  | "commercial"
  | "other";

export type ProjectStatus =
  | "draft"
  | "active"
  | "renovation"
  | "for_sale"
  | "sold"
  | "archived";

export type AssumptionSource =
  | "VERIFIED"
  | "USER_INPUT"
  | "ESTIMATE"
  | "TAX_ADVISOR_INPUT";

export type ScenarioType = "PRIVATE_EQUITY" | "PRIVATE_DEBT" | "EXISTING_COMPANY";

export const SCENARIO_LABELS: Record<ScenarioType, string> = {
  PRIVATE_EQUITY: "Privat, utan lån",
  PRIVATE_DEBT: "Privat, med lån",
  EXISTING_COMPANY: "Bolaget äger",
};

export type OwnerKind = "PRIVATE" | "EXISTING_COMPANY";

export type PrivateUseLevel = "none" | "occasional" | "frequent" | "full_disposition";

export type PrivatePropertyTaxClassification =
  | "private_residential_property"
  | "business_property"
  | "property_trading_inventory_risk";

export type CompanyAssetClassification = "capital_asset" | "inventory_property";

export type VatTreatment = "none" | "partial" | "full";

export type OptimizationTarget =
  | "max_private_cash"
  | "max_company_cash"
  | "max_family_net_worth"
  | "max_equity_roi"
  | "min_peak_cash_required"
  | "min_tax";

export const OPTIMIZATION_TARGET_LABELS: Record<OptimizationTarget, string> = {
  max_private_cash: "Mest pengar privat",
  max_company_cash: "Mest kvar i bolaget",
  max_family_net_worth: "Mest pengar till er efter skatt",
  max_equity_roi: "Högst avkastning på insatt kapital",
  min_peak_cash_required: "Minst kapital som binds",
  min_tax: "Lägst skatt",
};

// ---------------------------------------------------------------------------
// Central tax configuration (section 6)
// ---------------------------------------------------------------------------

export interface TaxConfig {
  taxYear: number;
  corporateTaxRate: number;
  privateResidentialCapitalGainEffectiveRate: number;
  capitalIncomeTaxRate: number;
  dividendTaxWithinAllowance: number;
  dividendTaxAboveAllowanceDefault: number | null;
  employerContributionRate: number;
  privateStampDutyRate: number;
  companyStampDutyRate: number;
  titleRegistrationFee: number;
  mortgageDeedTaxRate: number;
  mortgageDeedAdminFee: number;
  rotRate: number;
  rotMaxPerPerson: number;
  rentalStandardDeduction: number;
  rentalPercentDeduction: number;
  propertyFeeRate: number;
  propertyFeeAnnualCap: number;
  unsecuredLoanInterestDeductionRate: number;
  securedLoanInterestDeductionRateDefault: number;
}

export interface TaxConfigSnapshot {
  taxYear: number;
  sourceVersion: string;
  lockedAt?: string;
  values: TaxConfig;
}

// ---------------------------------------------------------------------------
// Object-level facts (entered once, shared by every scenario) — section 7 & 31
// ---------------------------------------------------------------------------

export interface PropertyFacts {
  address?: string;
  municipality?: string;
  propertyDesignation?: string;
  propertyType: PropertyType;
  tenure?: "freehold" | "leasehold" | "condominium" | "other";
  constructionYear?: number | null;
  livingAreaSqm?: number | null;
  ancillaryAreaSqm?: number | null;
  plotAreaSqm?: number | null;
  taxAssessmentType?: string | null;
  structureNotes?: string;
  siteNotes?: string;
  notes?: string;
}

export interface ProjectInputs {
  purchasePrice: number | null;
  priorYearTaxAssessmentValue: number | null;
  existingMortgageDeeds: number | null;
  expectedSalePrice: number | null;
  holdingPeriodMonths: number;
  acquisitionDate?: string | null;
  saleDate?: string | null;
  ownershipSharePerson1: number; // 0..1
  ownershipSharePerson2: number; // 0..1
}

export interface RenovationInputs {
  laborGross: number;
  materialsGross: number;
  architect: number;
  structuralEngineer: number;
  buildingPermit: number;
  controlManager: number;
  inspection: number;
  groundWorks: number;
  demolition: number;
  wasteAndContainers: number;
  transport: number;
  equipmentRental: number;
  projectManagement: number;
  appliances: number;
  fixedInterior: number;
  looseInterior: number;
  styling: number;
  landscaping: number;
  other: number;
  contingencyPercent: number;
  notes?: string;
}

export interface ImprovementTaxBasisInputs {
  fundamentalImprovementsPercent: number; // % of renovation subtotal (post-ROT) eligible as capital-improvement basis
  qualifyingRepairsAndMaintenancePercent: number; // deductible against rental/company result, not basis
  nonDeductiblePercent: number;
}

export interface VatLineOverride {
  id: string;
  label: string;
  grossAmount: number;
  vatRate: number;
  deductiblePercent: number;
}

/**
 * Faktafrågor om hur projektet ska drivas.
 *
 * Svaren avgör inte momsen — de avgör vilka frågor som är relevanta att
 * ställa. Appen drar aldrig slutsatsen att avdrag medges; den pekar ut när
 * frågan behöver ställas till någon som kan svara.
 */
export type BuildWorkBy = "unknown" | "contractors" | "own_staff";
export type IntendedPropertyUse =
  | "unknown"
  | "sell_residential"
  | "rent_residential"
  | "rent_short_term_hotel_like"
  | "rent_commercial"
  | "mixed";
export type YesNoUnknown = "unknown" | "yes" | "no";

export interface VatInputs {
  vatTreatment: VatTreatment;
  vatDeductiblePercent: number;
  lines: VatLineOverride[];
  /** Vem som utför byggarbetet — egen personal kan utlösa uttagsbeskattning. */
  buildWorkBy: BuildWorkBy;
  /** Vad huset ska användas till, vilket styr om verksamheten är momsfri. */
  intendedUse: IntendedPropertyUse;
  /** Om fastigheten är frivilligt skattskyldig, vilket bara gäller lokaler. */
  voluntaryTaxLiability: YesNoUnknown;
}

export interface RotInputs {
  enabled: boolean;
  eligibleLaborCostGross: number;
  eligibleOwners: number;
  remainingAllowancePerson1: number;
  remainingAllowancePerson2: number;
}

// Hidden / frequently missed costs (section 19) — modelled as an editable checklist
export interface HiddenCostItem {
  id: string;
  label: string;
  amount: number;
  included: boolean;
}

// ---------------------------------------------------------------------------
// Running ownership costs (section 18)
// ---------------------------------------------------------------------------

export interface RunningCosts {
  electricityAnnual: number;
  heatingAnnual: number;
  waterSewerAnnual: number;
  wasteAnnual: number;
  internetAnnual: number;
  insuranceAnnual: number;
  propertyFeeAnnual: number | null; // null => auto-calculate from tax assessment value
  alarmAnnual: number;
  landscapingAnnual: number;
  snowRemovalAnnual: number;
  repairsAnnual: number;
  travelAnnual: number;
  bookkeepingAnnual: number;
  bankingAnnual: number;
  securityAnnual: number;
  otherAnnual: number;
}

// ---------------------------------------------------------------------------
// Rental (section 20)
// ---------------------------------------------------------------------------

export interface RentalInputs {
  enabled: boolean;
  rentedWeeks: number;
  rentPerWeek: number;
  platformFeePercent: number;
  cleaningPerStay: number;
  numberOfStays: number;
  extraUtilities: number;
  extraWearAndTear: number;
}

// ---------------------------------------------------------------------------
// Sale (section 22)
// ---------------------------------------------------------------------------

export interface SaleInputs {
  brokerFeeFixed: number;
  brokerFeePercent: number;
  photography: number;
  styling: number;
  inspection: number;
  sellerInsurance: number;
  cleaning: number;
  legal: number;
  other: number;
  priceNegotiationBufferRate: number;
}

// ---------------------------------------------------------------------------
// Funding / financing — differs per scenario (section 12, 13, 14, 15, 16, 17)
// ---------------------------------------------------------------------------

export interface PrivateFundingInputs {
  existingPrivateCash: number;
  targetNetDividend: number;
  targetNetSalary: number;
}

export interface PrivateLoanInputs {
  mortgageAmount: number;
  mortgageInterestRate: number;
  mortgageSetupFee: number;
  mortgageAmortizationAnnual: number;
  unsecuredLoanAmount: number;
  unsecuredInterestRate: number;
  unsecuredSetupFee: number;
  unsecuredAmortizationAnnual: number;
  securedLoanInterestDeductionRate: number;
  unsecuredLoanInterestDeductionRate: number;
  /**
   * Lån privat från ett bolag ägarna äger eller är närstående till — t.ex.
   * för att finansiera kontantinsatsen. Räntemässigt behandlas det som ett
   * vanligt lån utan säkerhet, men det bär en egen, allvarlig skatterisk
   * (se riskFlags.ts: shareholder_loan_prohibition_risk) som inte har att
   * göra med räntesatsen.
   */
  companyLoanAmount: number;
  companyLoanInterestRate: number;
}

export interface DividendInputs {
  availableLowTaxAllowance: number;
  dividendTaxWithinAllowance: number;
  dividendTaxAboveAllowance: number | null;
}

export interface SalaryInputs {
  effectiveMarginalIncomeTaxRate: number;
  employerContributionRate: number;
}

export interface CompanyFundingInputs {
  companyCashInvested: number;
  externalBusinessLoan: number;
  businessInterestRate: number;
  setupFee: number;
  guaranteeFee: number;
  amortizationAnnual: number;
  deductibleInterestPercent: number;
  personalGuarantee: boolean;
}

export interface BenefitInputs {
  estimatedAnnualMarketBenefitValue: number;
  ownerIncomeTaxRateOnBenefit: number;
  employerContributionRate: number;
}

export interface OpportunityCostInputs {
  annualAlternativeReturnRate: number;
}

/** Everything that varies by ownership scenario rather than by the property itself. */
export interface ScenarioInputs {
  type: ScenarioType;
  enabled: boolean;
  ownerKind: OwnerKind;

  privateFunding: PrivateFundingInputs;
  privateLoans: PrivateLoanInputs;
  dividend: DividendInputs;
  salary: SalaryInputs;

  companyFunding: CompanyFundingInputs;

  vat: VatInputs;
  rot: RotInputs;

  privateUseLevel: PrivateUseLevel;
  benefit: BenefitInputs;

  privatePropertyTaxClassification: PrivatePropertyTaxClassification;
  companyAssetClassification: CompanyAssetClassification;
  improvementBasis: ImprovementTaxBasisInputs;

  opportunityCost: OpportunityCostInputs;

  flipIntent: boolean;
  classificationConfirmedByAdvisor: boolean;
}

// ---------------------------------------------------------------------------
// Risk flags & warnings (section 25, 43)
// ---------------------------------------------------------------------------

export type RiskSeverity = "low" | "medium" | "high";

export interface RiskFlag {
  id: string;
  severity: RiskSeverity;
  text: string;
}

export interface Warning {
  id: string;
  text: string;
}

// ---------------------------------------------------------------------------
// Root project record (section 31 project-management shape)
// ---------------------------------------------------------------------------

export interface PropertyProject {
  schemaVersion: number;
  id: string;
  name: string;
  status: ProjectStatus;
  archived: boolean;
  currency: Currency;
  createdAt: string;
  updatedAt: string;

  facts: PropertyFacts;
  inputs: ProjectInputs;
  renovation: RenovationInputs;
  operatingCosts: RunningCosts;
  rental: RentalInputs;
  sale: SaleInputs;
  hiddenCosts: HiddenCostItem[];

  scenarios: Record<ScenarioType, ScenarioInputs>;
  compareScenarios: ScenarioType[];
  selectedScenario: ScenarioType;
  optimizationTarget: OptimizationTarget;

  taxOverrides: Partial<TaxConfig>;
  taxConfigSnapshot: TaxConfigSnapshot | null;

  aiChat: AiChatMessage[];

  notes?: string;
}

export interface AiChatMessage {
  role: "user" | "assistant";
  text: string;
  ts: string;
}

export interface SavedProjectFile {
  schemaVersion: number;
  exportedAt: string;
  projects: PropertyProject[];
}

// ---------------------------------------------------------------------------
// Calculation outputs
// ---------------------------------------------------------------------------

export interface AuditLine {
  label: string;
  value: number | string;
}

export interface AuditTrail {
  title: string;
  lines: AuditLine[];
  source: AssumptionSource;
}

export interface PurchaseCostResult {
  stampDutyBase: number;
  stampDuty: number;
  titleRegistrationFee: number;
  titleCost: number;
  requiredMortgageDeeds: number;
  newMortgageDeedTax: number;
  newMortgageDeedCost: number;
  totalPurchaseCosts: number;
  audit: AuditTrail[];
}

export interface RenovationResult {
  renovationSubtotal: number;
  contingency: number;
  renovationTotalGross: number;
  audit: AuditTrail[];
}

export interface VatResult {
  grossAmount: number;
  vatIncluded: number;
  deductibleVat: number;
  nonDeductibleVat: number;
  trueCashCost: number;
  warning?: string;
  audit: AuditTrail[];
}

export interface RotResult {
  potentialRot: number;
  availableRotAllowance: number;
  rotDeduction: number;
  privateRenovationCashCost: number;
  audit: AuditTrail[];
}

export interface ImprovementBasisResult {
  renovationTotal: number;
  fundamentalImprovements: number;
  qualifyingRepairs: number;
  eligibleTaxBasis: number;
  nonEligibleRenovation: number;
  /** Sant om andelarna i ImprovementTaxBasisInputs inte summerar till 1. */
  splitWarning?: string;
  audit: AuditTrail[];
}

export interface LoanResult {
  grossMortgageInterest: number;
  mortgageTaxReduction: number;
  netMortgageInterest: number;
  grossUnsecuredInterest: number;
  unsecuredTaxReduction: number;
  netUnsecuredInterest: number;
  grossCompanyLoanInterest: number;
  companyLoanTaxReduction: number;
  netCompanyLoanInterest: number;
  totalSetupFees: number;
  totalAmortization: number;
  audit: AuditTrail[];
}

export interface DividendResult {
  targetNet: number;
  withinAllowanceGross: number;
  withinAllowanceTax: number;
  aboveAllowanceGross: number;
  aboveAllowanceTax: number;
  grossDividendRequired: number;
  dividendTax: number;
  netCashToOwner: number;
  allowanceConsumed: number;
  allowanceExceeded: boolean;
  audit: AuditTrail[];
}

export interface SalaryResult {
  grossSalary: number;
  employerContribution: number;
  companyCashCost: number;
  companyCashCostPerPrivateSek: number;
  audit: AuditTrail[];
}

export interface CompanyFundingResult {
  totalEquityCommitted: number;
  debt: number;
  businessInterest: number;
  deductibleInterest: number;
  fees: number;
  maxCashRequirement: number;
  audit: AuditTrail[];
}

export interface RunningCostResult {
  totalAnnual: number;
  calculatedPropertyFee: number;
  projectRunningCost: number;
  audit: AuditTrail[];
}

export interface RentalResult {
  grossRentalIncome: number;
  standardDeduction: number;
  percentDeduction: number;
  privateTaxableRentalSurplus: number;
  privateRentalTax: number;
  deductibleRentalCosts: number;
  companyRentalProfit: number;
  netRentalCashPrivate: number;
  netRentalCashCompany: number;
  warning?: string;
  audit: AuditTrail[];
}

export interface BenefitResult {
  proratedBenefitValue: number;
  ownerBenefitTax: number;
  companyEmployerContributionOnBenefit: number;
  combinedEconomicCost: number;
  audit: AuditTrail[];
}

export interface SaleCostResult {
  brokerFee: number;
  saleCostsTotal: number;
  audit: AuditTrail[];
}

export interface CapitalGainResult {
  taxBasis: number;
  capitalGain: number;
  capitalGainTax: number;
  classificationApplied: PrivatePropertyTaxClassification | CompanyAssetClassification;
  audit: AuditTrail[];
}

export interface CorporateTaxResult {
  taxableSaleResult: number;
  companyTax: number;
  companyProfitAfterTax: number;
  audit: AuditTrail[];
}

export interface ExtractionResult {
  companyProfitAfterTax: number;
  withinDividendAllowance: number;
  aboveDividendAllowance: number;
  retainedInCompany: number;
  ownerExtractionTax: number;
  netPrivateFromCompanyProfit: number;
  /** True when profit exceeds the allowance and no above-allowance rate was supplied. */
  aboveAllowanceRateMissing: boolean;
  audit: AuditTrail[];
}

export interface OpportunityCostResult {
  averageEquityCapitalTiedUp: number;
  opportunityCost: number;
  audit: AuditTrail[];
}

export interface MonthlyCashFlow {
  month: number;
  openingCash: number;
  equityInjection: number;
  loanDrawdown: number;
  purchaseCost: number;
  renovationSpend: number;
  runningCost: number;
  interest: number;
  rentalIncome: number;
  saleIncome: number;
  taxes: number;
  amortization: number;
  /** Kvarvarande lån löst ur försäljningslikviden — bara i utflyttsmånaden. */
  loanRepayment: number;
  closingCash: number;
}

export interface CashFlowResult {
  months: MonthlyCashFlow[];
  peakCashRequirement: number;
  peakDebt: number;
  equityRequired: number;
  totalInterest: number;
  monthOfMaxFundingNeed: number;
}

export interface RoiResult {
  totalProjectCost: number;
  projectProfit: number;
  projectROI: number;
  investedEquity: number;
  netProfit: number;
  equityROI: number;
  annualizedEquityROI: number | null;
}

export interface BreakEvenResult {
  breakEvenSalePrice: number | null;
  salePriceFor10PctROI: number | null;
  salePriceFor20PctROI: number | null;
  salePriceFor30PctROI: number | null;
  iterations: number;
  converged: boolean;
}

export interface FamilyNetWorthResult {
  modeA_retainedCompanyWealth: number;
  modeB_fullyExtractedPrivateWealth: number;
  baselineFamilyNetWorth: number;
  familyNetWorthDeltaModeA: number;
  familyNetWorthDeltaModeB: number;
  audit: AuditTrail[];
}

export interface ScenarioResult {
  scenario: ScenarioType;
  label: string;
  purchase: PurchaseCostResult;
  renovation: RenovationResult;
  vat: VatResult;
  rot: RotResult;
  improvementBasis: ImprovementBasisResult;
  loans: LoanResult;
  dividend: DividendResult | null;
  salary: SalaryResult | null;
  companyFunding: CompanyFundingResult | null;
  runningCosts: RunningCostResult;
  rental: RentalResult;
  benefit: BenefitResult | null;
  saleCosts: SaleCostResult;
  capitalGain: CapitalGainResult;
  corporateTax: CorporateTaxResult | null;
  extraction: ExtractionResult | null;
  opportunityCost: OpportunityCostResult;
  cashFlow: CashFlowResult;
  roi: RoiResult;
  breakEven: BreakEvenResult;
  familyNetWorth: FamilyNetWorthResult;
  riskFlags: RiskFlag[];
  warnings: Warning[];

  purchasePrice: number;
  /** True when no expected sale price is entered — exit-dependent KPIs are then not assessable. */
  salePriceMissing: boolean;
  /**
   * True when getting the company profit out to the owners requires a dividend
   * tax rate above the allowance that nobody has supplied. Private-cash KPIs
   * are then unknown rather than tax-free.
   */
  extractionRateUnknown: boolean;
  totalCapitalRequirement: number;
  equityCommitted: number;
  externalDebt: number;
  purchaseTaxesFees: number;
  renovationCashCost: number;
  financingCost: number;
  runningCostsTotal: number;
  totalProjectCost: number;
  salePrice: number;
  profitBeforeTax: number;
  totalTax: number;
  profitAfterTax: number;
  netRetainedInCompany: number;
  netAvailablePrivately: number;
}
