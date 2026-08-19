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
      text: "Ni har inte fyllt i vad ni tror att huset kan säljas för. Utan det går vinsten inte att räkna ut.",
    });
  }
  if (project.inputs.priorYearTaxAssessmentValue === null) {
    flags.push({
      id: "tax_assessment_missing",
      severity: "medium",
      text: "Taxeringsvärdet saknas. Lagfartskostnaden räknas på det högsta av pris och taxeringsvärde, så den kan bli något annorlunda.",
    });
  }
  if (project.inputs.existingMortgageDeeds === null) {
    flags.push({
      id: "mortgage_deeds_missing",
      severity: "medium",
      text: "Vi vet inte hur mycket pantbrev som redan finns. Behövs nya kostar de 2 % av beloppet.",
    });
  }
  if (project.inputs.holdingPeriodMonths < 12) {
    flags.push({
      id: "short_holding_period",
      severity: "medium",
      text: "Ni äger huset kortare än ett år. Då är risken större att Skatteverket ser det som näringsverksamhet i stället för en privat bostadsaffär.",
    });
  }
  if (scenario.flipIntent) {
    flags.push({
      id: "explicit_flip_intent",
      severity: "high",
      text: "Ni har angett att syftet är att renovera och sälja. Då kan man inte räkna med den låga skatten som gäller för en privatbostad.",
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
      text: "Ingen rådgivare har bekräftat att huset räknas som privatbostad. Det avgör om skatten på vinsten blir 22 % eller betydligt mer.",
    });
  }
  if (!ctx.isCompanyOwned && scenario.privateUseLevel === "none") {
    flags.push({
      id: "no_private_use",
      severity: "medium",
      text: "Ni äger huset privat men ska inte använda det själva. Det talar emot att det räknas som en privatbostad.",
    });
  }
  if (ctx.isCompanyOwned && scenario.privateUseLevel !== "none") {
    flags.push({
      id: "company_private_use_risk",
      severity: "high",
      text: "Bolaget äger huset och ni kan använda det själva. Då kan ni behöva skatta för det som en förmån — även dagar ni inte är där.",
    });
  }
  if (ctx.vatDeductibleVat > 0) {
    flags.push({
      id: "vat_deduction_claimed_on_residence",
      severity: "high",
      text: "Ni drar av moms på renovering av en bostad. Det är sällan tillåtet och behöver stämmas av.",
    });
  }
  if (ctx.intercompanyLoan > 0 && ctx.companyEquity > 0 && ctx.intercompanyLoan > ctx.companyEquity * 3) {
    flags.push({
      id: "high_intercompany_debt",
      severity: "medium",
      text: "Lånet mellan bolagen är stort jämfört med det egna kapitalet. Då får räntan kanske inte dras av fullt ut.",
    });
  }
  if (ctx.dividendAllowanceExceeded) {
    flags.push({
      id: "dividend_allowance_exceeded",
      severity: "medium",
      text: "Vinsten är större än det ni får ta ut till låg skatt. Vad resten kostar i skatt måste ni fylla i.",
    });
  }
  if (scenario.vat.vatDeductiblePercent === 0 && ctx.isCompanyOwned) {
    flags.push({
      id: "vat_default_zero",
      severity: "low",
      text: "Vi räknar med noll momsavdrag på renoveringen, vilket är det försiktiga antagandet. Ändra bara om en rådgivare säger något annat.",
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
      text: "Skatten för att ni kan använda huset kan räknas på att ni har rätt att vara där — inte bara på de dagar ni faktiskt är det. Fråga en rådgivare.",
    });
  }
  if (
    !ctx.isCompanyOwned &&
    ctx.scenario.privatePropertyTaxClassification === "private_residential_property" &&
    ctx.scenario.flipIntent
  ) {
    warnings.push({
      id: "flip_intent",
      text: "Ni har både angett att huset är en privatbostad och att syftet är att renovera och sälja. Det går inte ihop — fråga en rådgivare.",
    });
  }
  if (ctx.project.inputs.holdingPeriodMonths < 12) {
    warnings.push({
      id: "short_holding",
      text: "Ni äger huset kortare än ett år.",
    });
  }
  if (params.salePriceMissing) {
    warnings.push({
      id: "sale_price",
      text: "Utan ett pris ni tror på är siffrorna bara ungefärliga.",
    });
  }
  if (params.renovationContingencyPercent < 0.05) {
    warnings.push({
      id: "contingency",
      text: "Ni har lagt undan mindre än 5 % för oförutsett i renoveringen. Det brukar bli mer.",
    });
  }
  if (params.unsecuredLoanAmount > 0) {
    warnings.push({
      id: "unsecured_loan",
      text: "Ni använder ett lån utan säkerhet i huset. Räntan på sådana lån får inte dras av från och med 2026.",
    });
  }
  if (ctx.dividendAllowanceExceeded) {
    warnings.push({
      id: "dividend_allowance",
      text: "Ni tar ut mer än vad som ryms i den låga skatten. Fyll i vad resten kostar.",
    });
  }
  if (params.taxDependsOnClassification) {
    warnings.push({
      id: "classification_material",
      text: "Hela utfallet hänger på hur huset räknas skattemässigt, och det har ingen bekräftat.",
    });
  }

  return warnings;
}

export function countHighRisk(result: ScenarioResult): number {
  return result.riskFlags.filter((f) => f.severity === "high").length;
}
