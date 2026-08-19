import type {
  PropertyProject,
  RiskFlag,
  ScenarioInputs,
  ScenarioType,
  ScenarioResult,
  Warning,
} from "@/types";
import { vatRiskFlags } from "./vatGuidance";

export interface RiskContext {
  project: PropertyProject;
  scenario: ScenarioInputs;
  scenarioType: ScenarioType;
  isCompanyOwned: boolean;
  vatDeductibleVat: number;
  vatPotentialAdjustmentRepayment: number;
  dividendAllowanceExceeded: boolean;
  /** Månader kvar av innehavstiden efter att renoveringen antas vara klar. */
  monthsAvailableForRental: number;
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
  if (project.facts.tenure === "leasehold" && (project.operatingCosts.tomtrattsavgaldAnnual || 0) === 0) {
    flags.push({
      id: "leasehold_ground_rent_missing",
      severity: "medium",
      text: "Huset står på tomträtt men ingen tomträttsavgäld är ifylld. Den kostnaden tillkommer varje år utöver fastighetsavgiften och kan vara betydande — fyll i under Driftkostnader.",
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
  if (!ctx.isCompanyOwned && scenario.privatePropertyTaxClassification === "property_trading_inventory_risk") {
    flags.push({
      id: "property_trading_not_capital_gain",
      severity: "high",
      text: "Vid handel med fastigheter beskattas vinsten inte som en kapitalvinst utan som inkomst av näringsverksamhet — progressiv kommunal och statlig skatt plus egenavgifter, ofta betydligt mer än kapitalvinstskatten. Skattesatsen i kalkylen är en grov uppskattning, inte en fastställd nivå. Stäm av den faktiska skattebelastningen med en rådgivare.",
    });
  }
  if (!ctx.isCompanyOwned && scenario.privateUseLevel === "none") {
    flags.push({
      id: "no_private_use",
      severity: "medium",
      text: "Ni äger huset privat men ska inte använda det själva. Det talar emot att det räknas som en privatbostad.",
    });
  }
  if (ctx.isCompanyOwned && scenario.companySaleStructure === "share_sale") {
    flags.push({
      id: "packaging_structure_risk",
      severity: "high",
      text: "Kalkylen räknar med att sälja bolaget (aktierna) i stället för fastigheten, så att värdeökningen blir skattefri i bolaget. Det kräver att strukturen finns på plats innan värdeökningen sker, inte i efterhand, och köparens rabatt för den övertagna latenta skatten är bara en uppskattning. Det här är inget appen kan verifiera — ta in juridisk och skatterådgivning innan ni planerar för en paketerad försäljning.",
    });
  }
  if (ctx.isCompanyOwned && scenario.purchasedFromRelatedParty) {
    flags.push({
      id: "related_party_purchase_price_risk",
      severity: "high",
      text: "Bolaget köper fastigheten av ägaren själv eller någon närstående i stället för av en oberoende säljare. Affären måste ske till marknadsvärde — sätts priset för lågt kan mellanskillnaden uttagsbeskattas hos säljaren, och säljer en privatperson till sitt eget bolag under marknadsvärdet kan priset räknas om enligt korrigeringsregeln i IL 53 kap. Ta in en oberoende värdering och stäm av med en rådgivare innan affären görs.",
    });
  }
  if (ctx.isCompanyOwned && scenario.privateUseLevel !== "none") {
    flags.push({
      id: "company_private_use_risk",
      severity: "high",
      text: "Bolaget äger huset och ni kan använda det själva. Då kan ni behöva skatta för det som en förmån — även dagar ni inte är där.",
    });
  }
  if (!ctx.isCompanyOwned && scenario.privateLoans.companyLoanAmount > 0) {
    flags.push({
      id: "shareholder_loan_prohibition_risk",
      severity: "high",
      text: "Ni räknar med att låna pengar privat av ett bolag ni äger eller är närstående till. Sådana lån till aktieägare är i grunden förbjudna enligt aktiebolagslagen, och även när ett undantag skulle gälla riskerar hela beloppet att beskattas direkt som lön eller utdelning i stället för att räknas som ett vanligt lån. Räkna inte med det här som en billig finansieringskälla förrän en rådgivare bekräftat att upplägget är tillåtet.",
    });
  }
  if (ctx.vatDeductibleVat > 0) {
    flags.push({
      id: "vat_deduction_claimed_on_residence",
      severity: "high",
      text: "Ni drar av moms på renovering av en bostad. Det är sällan tillåtet och behöver stämmas av.",
    });
  }
  if (ctx.vatPotentialAdjustmentRepayment > 0) {
    flags.push({
      id: "vat_adjustment_risk",
      severity: "high",
      text: "Ni har dragit av moms på investeringen. Om fastighetens användning ändras inom tio år efter renoveringen — vanligast genom att den säljs till någon som inte fortsätter med momspliktig verksamhet — kan en del av den avdragna momsen behöva betalas tillbaka (jämkning). Den möjliga återbetalningen räknas fram utifrån hur mycket av tioårsperioden som återstår, men dras inte av från vinsten här eftersom det beror på köparens fortsatta användning.",
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

  // Momsen bedöms för sig, utifrån hur projektet ska drivas.
  flags.push(...vatRiskFlags(scenario, ctx.scenarioType));

  return flags;
}

export function buildWarnings(params: {
  ctx: RiskContext;
  renovationContingencyPercent: number;
  unsecuredLoanAmount: number;
  salePriceMissing: boolean;
  noBrokerFeeAssumed: boolean;
  taxDependsOnClassification: boolean;
  vatWarning?: string;
  rentalWarning?: string;
  improvementSplitWarning?: string;
  companyDeferredTaxAssetValue?: number;
}): Warning[] {
  const warnings: Warning[] = [];
  const { ctx } = params;

  if (params.companyDeferredTaxAssetValue && params.companyDeferredTaxAssetValue > 0) {
    warnings.push({
      id: "company_loss_deferred_tax_asset",
      text: "Affären går med underskott i bolaget. Det ger ingen skatteåterbäring nu — bara ett sparat avdrag som är värt något först om bolaget någon gång får annan vinst att kvitta det mot. Det värdet räknas inte in i vinsten som visas här.",
    });
  }

  if (params.vatWarning) warnings.push({ id: "vat", text: params.vatWarning });
  if (params.rentalWarning) warnings.push({ id: "rental", text: params.rentalWarning });
  if (params.improvementSplitWarning) {
    warnings.push({ id: "improvement_split", text: params.improvementSplitWarning });
  }

  if (ctx.project.rental.enabled && ctx.monthsAvailableForRental === 0) {
    warnings.push({
      id: "rental_no_time_after_renovation",
      text: "Innehavstiden räcker inte till uthyrning efter att renoveringen antas vara klar. Uthyrningsintäkten räknas ändå in i resultatet, men kassaflödet visar den inte under några månader — förläng innehavstiden eller minska uthyrningen så det stämmer med verkligheten.",
    });
  }

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
  if (params.noBrokerFeeAssumed) {
    warnings.push({
      id: "broker_fee",
      text: "Inget mäklararvode är ifyllt vid försäljningen. Vid en vanlig försäljning kostar det oftast några procent av priset — fyll i under Försäljning.",
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
