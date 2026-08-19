import type { RunningCostResult, RunningCosts } from "@/types";

export const RUNNING_COST_KEYS = [
  "electricityAnnual",
  "heatingAnnual",
  "waterSewerAnnual",
  "wasteAnnual",
  "internetAnnual",
  "insuranceAnnual",
  "tomtrattsavgaldAnnual",
  "samfallighetsavgiftAnnual",
  "alarmAnnual",
  "landscapingAnnual",
  "snowRemovalAnnual",
  "repairsAnnual",
  "travelAnnual",
  "bookkeepingAnnual",
  "bankingAnnual",
  "securityAnnual",
  "otherAnnual",
] as const;

export type RunningCostKey = (typeof RUNNING_COST_KEYS)[number];

export const RUNNING_COST_LABELS: Record<RunningCostKey, string> = {
  electricityAnnual: "El",
  heatingAnnual: "Uppvärmning",
  waterSewerAnnual: "Vatten och avlopp",
  wasteAnnual: "Sophämtning",
  internetAnnual: "Internet",
  insuranceAnnual: "Försäkring",
  tomtrattsavgaldAnnual: "Tomträttsavgäld",
  samfallighetsavgiftAnnual: "Samfällighetsavgift",
  alarmAnnual: "Larm",
  landscapingAnnual: "Trädgård",
  snowRemovalAnnual: "Snöröjning",
  repairsAnnual: "Reparationer",
  travelAnnual: "Resor",
  bookkeepingAnnual: "Bokföring",
  bankingAnnual: "Bankkostnader",
  securityAnnual: "Bevakning",
  otherAnnual: "Övrigt",
};

/** Hus med värdeår 2012 eller senare är befriade från fastighetsavgift i 15 år. */
export const NEW_CONSTRUCTION_EXEMPTION_FROM_VALUE_YEAR = 2012;
export const NEW_CONSTRUCTION_EXEMPTION_YEARS = 15;

export function isNewConstructionFeeExempt(
  constructionYear: number | null | undefined,
  taxYear: number,
): boolean {
  if (!constructionYear) return false;
  return (
    constructionYear >= NEW_CONSTRUCTION_EXEMPTION_FROM_VALUE_YEAR &&
    taxYear - constructionYear < NEW_CONSTRUCTION_EXEMPTION_YEARS
  );
}

export function calculatePropertyFee(
  taxAssessmentValue: number,
  propertyFeeRate: number,
  propertyFeeAnnualCap: number,
  newConstruction?: { constructionYear: number | null | undefined; taxYear: number },
): number {
  if (newConstruction && isNewConstructionFeeExempt(newConstruction.constructionYear, newConstruction.taxYear)) {
    return 0;
  }
  return Math.min((taxAssessmentValue || 0) * propertyFeeRate, propertyFeeAnnualCap);
}

export function calculateRunningCosts(params: {
  costs: RunningCosts;
  holdingPeriodMonths: number;
  taxAssessmentValue: number;
  propertyFeeRate: number;
  propertyFeeAnnualCap: number;
  constructionYear?: number | null;
  taxYear: number;
}): RunningCostResult {
  const holdingFactor = params.holdingPeriodMonths / 12;

  const feeExempt = isNewConstructionFeeExempt(params.constructionYear, params.taxYear);
  const calculatedPropertyFee = calculatePropertyFee(
    params.taxAssessmentValue,
    params.propertyFeeRate,
    params.propertyFeeAnnualCap,
    { constructionYear: params.constructionYear, taxYear: params.taxYear },
  );
  const propertyFeeAnnual =
    params.costs.propertyFeeAnnual === null || params.costs.propertyFeeAnnual === undefined
      ? calculatedPropertyFee
      : params.costs.propertyFeeAnnual;

  const lineTotal = RUNNING_COST_KEYS.reduce((sum, key) => sum + (params.costs[key] || 0), 0);
  const totalAnnual = lineTotal + propertyFeeAnnual;
  const projectRunningCost = totalAnnual * holdingFactor;

  const exemptionAuditLine =
    feeExempt && params.costs.propertyFeeAnnual === null
      ? [
          {
            label: "Anledning till 0 kr fastighetsavgift",
            value: "Nybyggnadsundantag: värdeår 2012 eller senare, befriad de första 15 åren",
          },
        ]
      : [];

  return {
    totalAnnual,
    calculatedPropertyFee,
    projectRunningCost,
    audit: [
      {
        title: "Löpande driftkostnader",
        source: "ESTIMATE",
        lines: [
          { label: "Poster per år", value: lineTotal },
          { label: "Fastighetsavgift per år", value: propertyFeeAnnual },
          ...exemptionAuditLine,
          { label: "Totalt per år", value: totalAnnual },
          { label: "Innehavstid", value: `${params.holdingPeriodMonths} mån` },
          { label: "Kostnad under innehavstiden", value: projectRunningCost },
        ],
      },
    ],
  };
}
