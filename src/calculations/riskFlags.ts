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
      text: "Förväntat försäljningspris saknas. Vinst och avkastning går inte att bedöma.",
    });
  }
  if (project.inputs.priorYearTaxAssessmentValue === null) {
    flags.push({
      id: "tax_assessment_missing",
      severity: "medium",
      text: "Taxeringsvärde saknas. Underlaget för lagfartskostnaden kan inte fastställas exakt.",
    });
  }
  if (project.inputs.existingMortgageDeeds === null) {
    flags.push({
      id: "mortgage_deeds_missing",
      severity: "medium",
      text: "Befintliga pantbrev saknas. Kostnaden för nya pantbrev kan inte fastställas exakt.",
    });
  }
  if (project.inputs.holdingPeriodMonths < 12) {
    flags.push({
      id: "short_holding_period",
      severity: "medium",
      text: "Innehavstiden är under 12 månader, vilket stärker argumentet för att detta är näringsverksamhet.",
    });
  }
  if (scenario.flipIntent) {
    flags.push({
      id: "explicit_flip_intent",
      severity: "high",
      text: "Syftet är uttalat renovera-och-sälj. Då kan man inte utgå från att huset räknas som privatbostad.",
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
      text: "Att huset räknas som privatbostad — och därmed 22 % kapitalvinstskatt — är inte bekräftat av rådgivare.",
    });
  }
  if (!ctx.isCompanyOwned && scenario.privateUseLevel === "none") {
    flags.push({
      id: "no_private_use",
      severity: "medium",
      text: "Ingen privat användning är planerad trots privat ägande, vilket försvagar klassificeringen som privatbostad.",
    });
  }
  if (ctx.isCompanyOwned && scenario.privateUseLevel !== "none") {
    flags.push({
      id: "company_private_use_risk",
      severity: "high",
      text: "Bolaget äger huset och ägarna kan använda det privat. Förmånsbeskattning måste utredas.",
    });
  }
  if (ctx.vatDeductibleVat > 0) {
    flags.push({
      id: "vat_deduction_claimed_on_residence",
      severity: "high",
      text: "Momsavdrag görs på renovering av bostad. Det kräver särskilt stöd i skattereglerna.",
    });
  }
  if (ctx.intercompanyLoan > 0 && ctx.companyEquity > 0 && ctx.intercompanyLoan > ctx.companyEquity * 3) {
    flags.push({
      id: "high_intercompany_debt",
      severity: "medium",
      text: "Koncernlånet är stort i förhållande till eget kapital. Reglerna om ränteavdragsbegränsning kan slå till.",
    });
  }
  if (ctx.dividendAllowanceExceeded) {
    flags.push({
      id: "dividend_allowance_exceeded",
      severity: "medium",
      text: "Gränsbeloppet för lågbeskattad utdelning överskrids. Skattesatsen däröver måste komma från rådgivare.",
    });
  }
  if (scenario.vat.vatDeductiblePercent === 0 && ctx.isCompanyOwned) {
    flags.push({
      id: "vat_default_zero",
      severity: "low",
      text: "Momsavdrag på bostadsrenovering är satt till 0 % som försiktig utgångspunkt. Ändra först efter kontroll.",
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
      text: "Förmånsbeskattning kan utgå från dispositionsrätten, inte bara de dagar huset används. Ta in skatteråd innan du litar på det här alternativet.",
    });
  }
  if (
    !ctx.isCompanyOwned &&
    ctx.scenario.privatePropertyTaxClassification === "private_residential_property" &&
    ctx.scenario.flipIntent
  ) {
    warnings.push({
      id: "flip_intent",
      text: "Privatbostad i kombination med uttalat renovera-och-sälj-syfte går inte ihop. Ta in skatteråd.",
    });
  }
  if (ctx.project.inputs.holdingPeriodMonths < 12) {
    warnings.push({
      id: "short_holding",
      text: "Innehavstiden är kortare än 12 månader.",
    });
  }
  if (params.salePriceMissing) {
    warnings.push({
      id: "sale_price",
      text: "Försäljningspris saknas — siffrorna är bara riktmärken.",
    });
  }
  if (params.renovationContingencyPercent < 0.05) {
    warnings.push({
      id: "contingency",
      text: "Posten för oförutsett i renoveringen är under 5 %.",
    });
  }
  if (params.unsecuredLoanAmount > 0) {
    warnings.push({
      id: "unsecured_loan",
      text: "Ett privatlån utan säkerhet används. Räntan på sådana lån är inte avdragsgill från inkomstår 2026.",
    });
  }
  if (ctx.dividendAllowanceExceeded) {
    warnings.push({
      id: "dividend_allowance",
      text: "Gränsbeloppet överskrids — skattesatsen över gränsbeloppet måste fyllas i.",
    });
  }
  if (params.taxDependsOnClassification) {
    warnings.push({
      id: "classification_material",
      text: "Resultatet hänger i hög grad på en skattemässig klassificering som ingen bekräftat.",
    });
  }

  return warnings;
}

export function countHighRisk(result: ScenarioResult): number {
  return result.riskFlags.filter((f) => f.severity === "high").length;
}
