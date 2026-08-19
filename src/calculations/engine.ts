import { mergeTaxConfig } from "@/config/taxConfig";
import type { PropertyProject, ScenarioResult, ScenarioType } from "@/types";
import { SCENARIO_LABELS } from "@/types";
import { calculateBenefitTax } from "./benefitTax";
import { calculateBreakEven } from "./breakEven";
import { buildCashFlow } from "./cashFlow";
import { calculatePrivateCapitalGain } from "./capitalGain";
import { calculateCorporateTax } from "./corporateTax";
import { calculateDividendGrossUp } from "./dividend";
import { calculateExtraction } from "./extraction";
import { calculateCompanyFunding } from "./fundingCompany";
import { calculateImprovementBasis } from "./improvementBasis";
import { calculatePrivateLoans } from "./loans";
import { calculateFamilyNetWorth } from "./netWorth";
import { calculateOpportunityCost } from "./opportunityCost";
import { calculateRunningCosts } from "./operatingCosts";
import { calculatePurchaseCosts } from "./purchase";
import { calculateRenovation } from "./renovation";
import { calculateRental } from "./rental";
import { buildRiskFlags, buildWarnings, type RiskContext } from "./riskFlags";
import { calculateRoi } from "./roi";
import { calculateRot } from "./rot";
import { calculateSaleCosts } from "./sale";
import { calculateSalaryExtraction } from "./salary";
import { calculateVat } from "./vat";

const DEFAULT_VAT_RATE = 0.25;

export function isCompanyScenario(type: ScenarioType): boolean {
  return type === "EXISTING_COMPANY";
}

export interface ScenarioOverrides {
  purchasePrice?: number;
  salePrice?: number;
  renovationMultiplier?: number;
  interestRateDelta?: number;
  holdingPeriodMonths?: number;
}

type CoreResult = Omit<ScenarioResult, "breakEven" | "riskFlags" | "warnings" | "label" | "scenario">;

/**
 * Single scenario pipeline. Ownership structure changes which modules
 * contribute, never the shape of the result — adding a scenario type means
 * extending the funding branch here, not rewriting the modules.
 */
function computeCore(
  project: PropertyProject,
  scenarioType: ScenarioType,
  overrides: ScenarioOverrides,
): CoreResult & { riskContext: RiskContext } {
  const config = mergeTaxConfig(project.taxConfigSnapshot?.values ?? project.taxOverrides);
  const scenario = project.scenarios[scenarioType];
  const isCompanyOwned = isCompanyScenario(scenarioType);

  const holdingPeriodMonths =
    overrides.holdingPeriodMonths ?? project.inputs.holdingPeriodMonths ?? 12;
  const purchasePrice = overrides.purchasePrice ?? project.inputs.purchasePrice ?? 0;
  const grossSalePrice = overrides.salePrice ?? project.inputs.expectedSalePrice ?? 0;
  const salePrice = grossSalePrice * (1 - (project.sale.priceNegotiationBufferRate || 0));
  const taxAssessmentValue = project.inputs.priorYearTaxAssessmentValue ?? 0;

  // --- Renovation, VAT, ROT ------------------------------------------------
  const renovationBase = calculateRenovation(project.renovation);
  const renoMultiplier = overrides.renovationMultiplier ?? 1;
  const renovation = {
    ...renovationBase,
    renovationSubtotal: renovationBase.renovationSubtotal * renoMultiplier,
    contingency: renovationBase.contingency * renoMultiplier,
    renovationTotalGross: renovationBase.renovationTotalGross * renoMultiplier,
  };

  const vat = calculateVat({
    renovationTotalGross: renovation.renovationTotalGross,
    vat: scenario.vat,
    defaultVatRate: DEFAULT_VAT_RATE,
    isCompanyOwned,
    holdingPeriodMonths,
  });

  const rot = calculateRot({
    rot: scenario.rot,
    renovationTotalGross: renovation.renovationTotalGross,
    rotRate: config.rotRate,
    rotMaxPerPerson: config.rotMaxPerPerson,
    isPrivateOwned: !isCompanyOwned,
  });

  const renovationCashCost = isCompanyOwned
    ? vat.trueCashCost
    : renovation.renovationTotalGross - rot.rotDeduction;

  // --- Financing -----------------------------------------------------------
  const rateDelta = overrides.interestRateDelta ?? 0;

  const privateLoansInput = {
    ...scenario.privateLoans,
    mortgageInterestRate: Math.max(0, scenario.privateLoans.mortgageInterestRate + rateDelta),
    unsecuredInterestRate: Math.max(0, scenario.privateLoans.unsecuredInterestRate + rateDelta),
    unsecuredLoanInterestDeductionRate: config.unsecuredLoanInterestDeductionRate,
  };
  const numberOfOwners = project.inputs.ownershipSharePerson2 > 0 ? 2 : 1;
  const loans = calculatePrivateLoans({
    loans: privateLoansInput,
    holdingPeriodMonths,
    numberOfOwners,
    securedLoanInterestDeductionRateTier2: config.securedLoanInterestDeductionRateTier2,
    securedLoanInterestDeductionThresholdPerPerson:
      config.securedLoanInterestDeductionThresholdPerPerson,
  });

  let companyFunding = null;
  if (scenarioType === "EXISTING_COMPANY") {
    companyFunding = calculateCompanyFunding({
      funding: {
        ...scenario.companyFunding,
        businessInterestRate: Math.max(0, scenario.companyFunding.businessInterestRate + rateDelta),
      },
      holdingPeriodMonths,
    });
  }

  const securedDebt = isCompanyOwned
    ? (companyFunding?.debt ?? 0)
    : privateLoansInput.mortgageAmount;

  const purchase = calculatePurchaseCosts({
    purchasePrice,
    priorYearTaxAssessmentValue: taxAssessmentValue,
    existingMortgageDeeds: project.inputs.existingMortgageDeeds ?? 0,
    securedDebt,
    isCompanyOwned,
    privateStampDutyRate: config.privateStampDutyRate,
    companyStampDutyRate: config.companyStampDutyRate,
    titleRegistrationFee: config.titleRegistrationFee,
    mortgageDeedTaxRate: config.mortgageDeedTaxRate,
    mortgageDeedAdminFee: config.mortgageDeedAdminFee,
  });

  const hiddenCostsTotal = project.hiddenCosts
    .filter((c) => c.included)
    .reduce((sum, c) => sum + (c.amount || 0), 0);

  // --- Running costs, rental, benefit --------------------------------------
  const runningCosts = calculateRunningCosts({
    costs: project.operatingCosts,
    holdingPeriodMonths,
    taxAssessmentValue,
    propertyFeeRate: config.propertyFeeRate,
    propertyFeeAnnualCap: config.propertyFeeAnnualCap,
    constructionYear: project.facts.constructionYear,
    taxYear: config.taxYear,
  });

  const rental = calculateRental({
    rental: project.rental,
    holdingPeriodMonths,
    isPrivateOwned: !isCompanyOwned,
    isPrivateResidential: scenario.privatePropertyTaxClassification === "private_residential_property",
    rentalStandardDeduction: config.rentalStandardDeduction,
    rentalPercentDeduction: config.rentalPercentDeduction,
    capitalIncomeTaxRate: config.capitalIncomeTaxRate,
  });

  const benefit = isCompanyOwned
    ? calculateBenefitTax({
        benefit: scenario.benefit,
        privateUseLevel: scenario.privateUseLevel,
        holdingPeriodMonths,
        isCompanyOwned,
      })
    : null;

  // --- Sale & tax basis ----------------------------------------------------
  const saleCosts = calculateSaleCosts({ sale: project.sale, expectedSalePrice: salePrice });

  const improvementBasis = calculateImprovementBasis({
    renovationTotalGross: renovation.renovationTotalGross,
    rotDeduction: rot.rotDeduction,
    split: scenario.improvementBasis,
  });

  const privateFinancingCost =
    loans.netMortgageInterest +
    loans.netUnsecuredInterest +
    loans.netCompanyLoanInterest +
    loans.totalSetupFees;
  const companyFinancingCost = companyFunding
    ? companyFunding.businessInterest + companyFunding.fees
    : 0;
  const financingCost = isCompanyOwned ? companyFinancingCost : privateFinancingCost;

  const eligiblePurchaseCosts = purchase.titleCost + hiddenCostsTotal;

  const capitalGain = calculatePrivateCapitalGain({
    salePrice,
    saleCosts: saleCosts.saleCostsTotal,
    purchasePrice,
    eligiblePurchaseCosts,
    eligibleImprovementCosts: improvementBasis.eligibleTaxBasis,
    classification: scenario.privatePropertyTaxClassification,
    privateResidentialEffectiveRate: config.privateResidentialCapitalGainEffectiveRate,
    businessPropertyEffectiveRate: config.businessPropertyCapitalGainEffectiveRate,
    propertyTradingRateAssumption: config.propertyTradingEffectiveRateAssumption,
    privateResidentialLossReliefRate: config.privateResidentialLossReliefRate,
    businessPropertyLossReliefRate: config.businessPropertyLossReliefRate,
  });

  const companyTaxBasis = purchasePrice + purchase.totalPurchaseCosts + renovationCashCost;

  // Värdeminskningsavdrag: bara byggnaden (inte marken) går att skriva av.
  // Avdraget sänker det löpande resultatet nu och återförs genom att sänka
  // det skattemässiga anskaffningsvärdet vid en tillgångsförsäljning — över
  // hela innehavstiden blir nettoeffekten då noll för den delen. Undantaget
  // är paketering (se nedan), där återföringen aldrig blir skattepliktig.
  const depreciableBase = isCompanyOwned
    ? companyTaxBasis * (scenario.buildingValueSharePercent || 0)
    : 0;
  const accumulatedDepreciation =
    depreciableBase * (scenario.annualDepreciationRatePercent || 0) * (holdingPeriodMonths / 12);
  const companyTaxBasisAfterDepreciation = companyTaxBasis - accumulatedDepreciation;

  const companyOtherResult =
    -(runningCosts.projectRunningCost + hiddenCostsTotal) -
    (companyFunding?.deductibleInterest ?? 0) -
    (companyFunding ? companyFunding.fees : 0) -
    accumulatedDepreciation +
    (project.rental.enabled ? rental.companyRentalProfit : 0) -
    (benefit?.companyEmployerContributionOnBenefit ?? 0);

  // Paketering (andelsförsäljning) gör själva fastighetsvinsten skattefri i
  // bolaget (IL 25a), men en köpare av aktierna tar över den latenta
  // skatteskulden och kräver normalt rabatt på priset för det. Den gör
  // också att återföringen av värdeminskningsavdraget aldrig blir
  // skattepliktig, så avdraget blir en permanent skattevinst i det läget.
  const isShareSale = isCompanyOwned && scenario.companySaleStructure === "share_sale";
  const shareSaleDiscount = isShareSale
    ? salePrice * (scenario.buyerLatentTaxDiscountPercent || 0)
    : 0;
  const companySalePrice = salePrice - shareSaleDiscount;

  const corporateTax = isCompanyOwned
    ? calculateCorporateTax({
        salePrice: companySalePrice,
        saleCosts: saleCosts.saleCostsTotal,
        companyTaxBasis: companyTaxBasisAfterDepreciation,
        otherDeductibleResult: companyOtherResult,
        corporateTaxRate: config.corporateTaxRate,
        classification: scenario.companyAssetClassification,
        disposalTaxExempt: isShareSale,
      })
    : null;

  // --- Cost of getting private capital out of the company ------------------
  const dividend =
    scenario.privateFunding.targetNetDividend > 0
      ? calculateDividendGrossUp({
          targetNetPrivateCash: scenario.privateFunding.targetNetDividend,
          dividend: scenario.dividend,
        })
      : null;

  const salary =
    scenario.privateFunding.targetNetSalary > 0
      ? calculateSalaryExtraction({
          targetNetSalary: scenario.privateFunding.targetNetSalary,
          salary: scenario.salary,
        })
      : null;

  const extractionCostOfPrivateFunding =
    (dividend?.dividendTax ?? 0) +
    (salary ? salary.companyCashCost - scenario.privateFunding.targetNetSalary : 0);

  // --- Second tax layer: project profit leaving the company ----------------
  const extraction = corporateTax
    ? calculateExtraction({
        companyProfitAfterTax: corporateTax.companyProfitAfterTax,
        dividend: scenario.dividend,
        extractionShare: 1,
      })
    : null;

  // --- Aggregation ---------------------------------------------------------
  const purchaseTaxesFees = purchase.totalPurchaseCosts;
  const runningCostsTotal = runningCosts.projectRunningCost + hiddenCostsTotal;

  const totalProjectCost =
    purchasePrice +
    purchaseTaxesFees +
    renovationCashCost +
    financingCost +
    runningCostsTotal +
    saleCosts.saleCostsTotal +
    (benefit?.combinedEconomicCost ?? 0) +
    (isCompanyOwned ? 0 : extractionCostOfPrivateFunding);

  const rentalContribution = project.rental.enabled
    ? isCompanyOwned
      ? rental.companyRentalProfit
      : rental.netRentalCashPrivate
    : 0;

  // Vid paketering är det den rabatterade köpeskillingen ägarna faktiskt
  // får ut, inte fastighetens fulla marknadsvärde — annars skulle vinsten
  // som visas inte gå ihop med skatten som faktiskt räknats på den.
  const profitBeforeTax =
    (isCompanyOwned ? companySalePrice : salePrice) - totalProjectCost + rentalContribution;

  const companyTaxTotal = corporateTax ? corporateTax.companyTax : 0;
  const ownerExtractionTax = extraction ? extraction.ownerExtractionTax : 0;
  const benefitTaxTotal = benefit ? benefit.combinedEconomicCost : 0;

  const totalTax = isCompanyOwned
    ? companyTaxTotal + ownerExtractionTax + benefitTaxTotal
    : capitalGain.capitalGainTax + (project.rental.enabled ? rental.privateRentalTax : 0);

  const profitAfterTax = isCompanyOwned
    ? (corporateTax?.companyProfitAfterTax ?? 0) - benefitTaxTotal
    : profitBeforeTax - capitalGain.capitalGainTax;

  const netRetainedInCompany = isCompanyOwned ? (corporateTax?.companyProfitAfterTax ?? 0) : 0;
  const netAvailablePrivately = isCompanyOwned
    ? (extraction?.netPrivateFromCompanyProfit ?? 0) - (benefit?.ownerBenefitTax ?? 0)
    : profitAfterTax;

  const externalDebt = isCompanyOwned
    ? (companyFunding?.debt ?? 0)
    : privateLoansInput.mortgageAmount +
      privateLoansInput.unsecuredLoanAmount +
      privateLoansInput.companyLoanAmount;

  const equityCommitted = isCompanyOwned
    ? (companyFunding?.totalEquityCommitted ?? 0)
    : scenario.privateFunding.existingPrivateCash +
      scenario.privateFunding.targetNetDividend +
      scenario.privateFunding.targetNetSalary;

  const interestTotal = isCompanyOwned
    ? (companyFunding?.businessInterest ?? 0)
    : loans.netMortgageInterest + loans.netUnsecuredInterest + loans.netCompanyLoanInterest;

  // Uthyrning kan börja tidigast när renoveringen är klar, så det avgör
  // både kassaflödets tidslinje (buildCashFlow) och om uthyrningen som är
  // ifylld ens ryms inom innehavstiden (varningen nedan).
  const renovationSpreadMonths = Math.max(1, Math.min(holdingPeriodMonths, 6));
  const monthsAvailableForRental = Math.max(0, holdingPeriodMonths - renovationSpreadMonths);

  const cashFlow = buildCashFlow({
    holdingPeriodMonths,
    purchasePrice,
    purchaseCosts: purchaseTaxesFees + hiddenCostsTotal,
    renovationCashCost,
    renovationSpreadMonths,
    runningCostAnnual: runningCosts.totalAnnual,
    rentalIncomeTotal: project.rental.enabled ? rental.grossRentalIncome : 0,
    interestTotal,
    amortizationAnnual: isCompanyOwned
      ? (scenario.companyFunding.amortizationAnnual || 0)
      : (privateLoansInput.mortgageAmortizationAnnual || 0) +
        (privateLoansInput.unsecuredAmortizationAnnual || 0),
    loanDrawdown: externalDebt,
    salePrice,
    saleCosts: saleCosts.saleCostsTotal,
    taxAtExit: isCompanyOwned ? companyTaxTotal : capitalGain.capitalGainTax,
  });

  const investedEquity = Math.max(cashFlow.equityRequired, equityCommitted, 1);
  const totalCapitalRequirement = cashFlow.peakCashRequirement + externalDebt;

  const opportunityCost = calculateOpportunityCost({
    cashFlow,
    annualAlternativeReturnRate: scenario.opportunityCost.annualAlternativeReturnRate,
    holdingPeriodMonths,
  });

  const netProfit = isCompanyOwned ? netAvailablePrivately : profitAfterTax;

  const roi = calculateRoi({
    totalProjectCost,
    projectProfit: profitAfterTax,
    investedEquity,
    netProfit,
    holdingPeriodMonths,
  });

  const familyNetWorth = calculateFamilyNetWorth({
    privateCashAfterProject: isCompanyOwned
      ? -(benefit?.ownerBenefitTax ?? 0)
      : cashFlow.equityRequired + profitAfterTax,
    companyValueAfterProject: isCompanyOwned
      ? (companyFunding?.totalEquityCommitted ?? 0) + netRetainedInCompany
      : 0,
    deferredOwnerTaxToExtract: isCompanyOwned ? ownerExtractionTax : 0,
    privateCapitalConsumed: isCompanyOwned ? 0 : cashFlow.equityRequired,
    companyCapitalConsumed: isCompanyOwned ? (companyFunding?.totalEquityCommitted ?? 0) : 0,
    remainingPrivateDebt: 0,
    remainingCompanyDebt: 0,
  });

  const riskContext: RiskContext = {
    project,
    scenario,
    isCompanyOwned,
    scenarioType,
    vatDeductibleVat: vat.deductibleVat,
    vatPotentialAdjustmentRepayment: vat.potentialAdjustmentRepayment,
    dividendAllowanceExceeded:
      (dividend?.allowanceExceeded ?? false) ||
      (extraction ? extraction.aboveDividendAllowance > 0 : false),
    monthsAvailableForRental,
  };

  return {
    purchase,
    renovation,
    vat,
    rot,
    improvementBasis,
    loans,
    dividend,
    salary,
    companyFunding,
    runningCosts,
    rental,
    benefit,
    saleCosts,
    capitalGain,
    corporateTax,
    extraction,
    opportunityCost,
    cashFlow,
    roi,
    familyNetWorth,
    purchasePrice,
    salePriceMissing: overrides.salePrice === undefined && project.inputs.expectedSalePrice === null,
    extractionRateUnknown: extraction?.aboveAllowanceRateMissing ?? false,
    totalCapitalRequirement,
    equityCommitted: investedEquity,
    externalDebt,
    purchaseTaxesFees,
    renovationCashCost,
    financingCost,
    runningCostsTotal,
    totalProjectCost,
    salePrice,
    profitBeforeTax,
    totalTax,
    profitAfterTax,
    netRetainedInCompany,
    netAvailablePrivately,
    riskContext,
  };
}

export function calculateScenario(
  project: PropertyProject,
  scenarioType: ScenarioType,
  overrides: ScenarioOverrides = {},
): ScenarioResult {
  const { riskContext, ...core } = computeCore(project, scenarioType, overrides);

  const purchasePrice = overrides.purchasePrice ?? project.inputs.purchasePrice ?? 0;

  const breakEven = calculateBreakEven({
    netProfitAtSalePrice: (sp) =>
      calculateScenarioLite(project, scenarioType, { ...overrides, salePrice: sp }).netProfit,
    equityRoiAtSalePrice: (sp) =>
      calculateScenarioLite(project, scenarioType, { ...overrides, salePrice: sp }).equityROI,
    upperBound: Math.max(50_000_000, (purchasePrice + core.renovation.renovationTotalGross) * 6),
  });

  const riskFlags = buildRiskFlags(riskContext);
  const warnings = buildWarnings({
    ctx: riskContext,
    renovationContingencyPercent: project.renovation.contingencyPercent,
    unsecuredLoanAmount: project.scenarios[scenarioType].privateLoans.unsecuredLoanAmount,
    salePriceMissing: project.inputs.expectedSalePrice === null,
    noBrokerFeeAssumed:
      project.inputs.expectedSalePrice !== null &&
      !project.sale.brokerFeeFixed &&
      !project.sale.brokerFeePercent,
    taxDependsOnClassification: !project.scenarios[scenarioType].classificationConfirmedByAdvisor,
    vatWarning: core.vat.warning,
    rentalWarning: core.rental.warning,
    improvementSplitWarning: riskContext.isCompanyOwned
      ? undefined
      : core.improvementBasis.splitWarning,
    companyDeferredTaxAssetValue: core.corporateTax?.deferredTaxAssetValue,
  });

  return {
    scenario: scenarioType,
    label: SCENARIO_LABELS[scenarioType],
    ...core,
    breakEven,
    riskFlags,
    warnings,
  };
}

export interface ScenarioLiteResult {
  netProfit: number;
  equityROI: number;
  profitAfterTax: number;
}

/**
 * Solver-facing view: same economics, no recursive break-even work.
 *
 * The metric must fall below zero when the sale price does, or a root finder
 * has nothing to bracket. Owner-level net cash is clamped at zero for a
 * company (you cannot distribute a loss), so the solver uses the project
 * result after tax instead — that is also what "break-even" means here.
 */
export function calculateScenarioLite(
  project: PropertyProject,
  scenarioType: ScenarioType,
  overrides: ScenarioOverrides = {},
): ScenarioLiteResult {
  const core = computeCore(project, scenarioType, overrides);
  const investedEquity = Math.max(core.roi.investedEquity, 1);

  return {
    netProfit: core.profitAfterTax,
    equityROI: core.profitAfterTax / investedEquity,
    profitAfterTax: core.profitAfterTax,
  };
}

export function calculateAllScenarios(
  project: PropertyProject,
  overrides: ScenarioOverrides = {},
): ScenarioResult[] {
  return project.compareScenarios.map((s) => calculateScenario(project, s, overrides));
}
