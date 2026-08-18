import type { RunningCostResult, RunningCosts } from "@/types";

export const RUNNING_COST_KEYS = [
  "electricityAnnual",
  "heatingAnnual",
  "waterSewerAnnual",
  "wasteAnnual",
  "internetAnnual",
  "insuranceAnnual",
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

export function calculatePropertyFee(
  taxAssessmentValue: number,
  propertyFeeRate: number,
  propertyFeeAnnualCap: number,
): number {
  return Math.min((taxAssessmentValue || 0) * propertyFeeRate, propertyFeeAnnualCap);
}

export function calculateRunningCosts(params: {
  costs: RunningCosts;
  holdingPeriodMonths: number;
  taxAssessmentValue: number;
  propertyFeeRate: number;
  propertyFeeAnnualCap: number;
  extraAnnualCosts?: number;
}): RunningCostResult {
  const holdingFactor = params.holdingPeriodMonths / 12;

  const calculatedPropertyFee = calculatePropertyFee(
    params.taxAssessmentValue,
    params.propertyFeeRate,
    params.propertyFeeAnnualCap,
  );
  const propertyFeeAnnual =
    params.costs.propertyFeeAnnual === null || params.costs.propertyFeeAnnual === undefined
      ? calculatedPropertyFee
      : params.costs.propertyFeeAnnual;

  const lineTotal = RUNNING_COST_KEYS.reduce((sum, key) => sum + (params.costs[key] || 0), 0);
  const totalAnnual = lineTotal + propertyFeeAnnual + (params.extraAnnualCosts || 0);
  const projectRunningCost = totalAnnual * holdingFactor;

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
          { label: "Totalt per år", value: totalAnnual },
          { label: "Innehavstid", value: `${params.holdingPeriodMonths} mån` },
          { label: "Kostnad under innehavstiden", value: projectRunningCost },
        ],
      },
    ],
  };
}
