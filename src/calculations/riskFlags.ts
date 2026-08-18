import type {
  PropertyProject,
  RiskFlag,
  ScenarioInputs,
  ScenarioResult,
  Warning,
} from "@/types";

export interface RiskContext {
  project: PropertyProject;
  scenario: ScenarioInputs;
  isCompanyOwned: boolean;
  vatDeductibleVat: number;
  dividendAllowanceExceeded: boolean;
  intercompanyLoan: number;
  companyEquity: number;
}

export function buildRiskFlags(ctx: RiskContext): RiskFlag[] {
  const flags: RiskFlag[] = [];
  const { project, scenario } = ctx;

  if (project.inputs.expectedSalePrice === null) {
    flags.push({
      id: "sale_price_missing",
      severity: "high",
      text: "Expected sale price is missing. Profit and ROI cannot be fully assessed.",
    });
  }
  if (project.inputs.priorYearTaxAssessmentValue === null) {
    flags.push({
      id: "tax_assessment_missing",
      severity: "medium",
      text: "Tax assessment value is missing. The stamp duty base cannot be established exactly.",
    });
  }
  if (project.inputs.existingMortgageDeeds === null) {
    flags.push({
      id: "mortgage_deeds_missing",
      severity: "medium",
      text: "Existing mortgage deeds are missing. New mortgage deed cost cannot be established exactly.",
    });
  }
  if (project.inputs.holdingPeriodMonths < 12) {
    flags.push({
      id: "short_holding_period",
      severity: "medium",
      text: "Holding period is under 12 months, which strengthens a business/trading classification argument.",
    });
  }
  if (scenario.flipIntent) {
    flags.push({
      id: "explicit_flip_intent",
      severity: "high",
      text: "Explicit renovate-and-sell intent is recorded. Private residential classification must not be assumed.",
    });
  }
  if (
    !ctx.isCompanyOwned &&
    scenario.privatePropertyTaxClassification === "private_residential_property" &&
    !scenario.classificationConfirmedByAdvisor
  ) {
    flags.push({
      id: "private_residence_classification_unconfirmed",
      severity: "high",
      text: "Private residential classification and the 22% effective capital gains rate are unconfirmed by an advisor.",
    });
  }
  if (!ctx.isCompanyOwned && scenario.privateUseLevel === "none") {
    flags.push({
      id: "no_private_use",
      severity: "medium",
      text: "No private use is planned for a privately owned property, which weakens private-residence classification.",
    });
  }
  if (ctx.isCompanyOwned && scenario.privateUseLevel !== "none") {
    flags.push({
      id: "company_private_use_risk",
      severity: "high",
      text: "The company owns the property and the owners can use it privately. Benefit taxation must be analysed.",
    });
  }
  if (ctx.vatDeductibleVat > 0) {
    flags.push({
      id: "vat_deduction_claimed_on_residence",
      severity: "high",
      text: "VAT deduction is claimed on residential renovation. This requires specific tax support.",
    });
  }
  if (ctx.intercompanyLoan > 0 && ctx.companyEquity > 0 && ctx.intercompanyLoan > ctx.companyEquity * 3) {
    flags.push({
      id: "high_intercompany_debt",
      severity: "medium",
      text: "Intercompany debt is high relative to equity. Interest deduction limitation rules may apply.",
    });
  }
  if (ctx.dividendAllowanceExceeded) {
    flags.push({
      id: "dividend_allowance_exceeded",
      severity: "medium",
      text: "The low-tax dividend allowance is exceeded. Tax above the allowance must be supplied by an advisor.",
    });
  }
  if (scenario.vat.vatDeductiblePercent === 0 && ctx.isCompanyOwned) {
    flags.push({
      id: "vat_default_zero",
      severity: "low",
      text: "VAT deduction on residential renovation is set to 0% as a cautious default; change only after verification.",
    });
  }

  return flags;
}

export function buildWarnings(params: {
  ctx: RiskContext;
  renovationContingencyPercent: number;
  unsecuredLoanAmount: number;
  salePriceMissing: boolean;
  taxDependsOnClassification: boolean;
  vatWarning?: string;
  rentalWarning?: string;
}): Warning[] {
  const warnings: Warning[] = [];
  const { ctx } = params;

  if (params.vatWarning) warnings.push({ id: "vat", text: params.vatWarning });
  if (params.rentalWarning) warnings.push({ id: "rental", text: params.rentalWarning });

  if (ctx.isCompanyOwned && ctx.scenario.privateUseLevel !== "none") {
    warnings.push({
      id: "benefit",
      text: "Benefit taxation may be based on the right to use the property, not only actual days used. Obtain tax advice before relying on this scenario.",
    });
  }
  if (
    !ctx.isCompanyOwned &&
    ctx.scenario.privatePropertyTaxClassification === "private_residential_property" &&
    ctx.scenario.flipIntent
  ) {
    warnings.push({
      id: "flip_intent",
      text: "A private residential classification combined with explicit flip intent is inconsistent. Obtain tax advice.",
    });
  }
  if (ctx.project.inputs.holdingPeriodMonths < 12) {
    warnings.push({
      id: "short_holding",
      text: "Holding period is under 12 months.",
    });
  }
  if (params.salePriceMissing) {
    warnings.push({ id: "sale_price", text: "Sale price is missing — results are indicative only." });
  }
  if (params.renovationContingencyPercent < 0.05) {
    warnings.push({
      id: "contingency",
      text: "Renovation contingency is below 5%.",
    });
  }
  if (params.unsecuredLoanAmount > 0) {
    warnings.push({
      id: "unsecured_loan",
      text: "An unsecured private loan is used. Interest on unsecured loans is not deductible from income year 2026.",
    });
  }
  if (ctx.dividendAllowanceExceeded) {
    warnings.push({
      id: "dividend_allowance",
      text: "Low-tax dividend allowance exceeded — tax above the allowance must be supplied.",
    });
  }
  if (params.taxDependsOnClassification) {
    warnings.push({
      id: "classification_material",
      text: "Profit depends materially on an uncertain tax classification.",
    });
  }

  return warnings;
}

export function countHighRisk(result: ScenarioResult): number {
  return result.riskFlags.filter((f) => f.severity === "high").length;
}
