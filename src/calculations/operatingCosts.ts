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
  electricityAnnual: "Electricity",
  heatingAnnual: "Heating",
  waterSewerAnnual: "Water & sewer",
  wasteAnnual: "Waste",
  internetAnnual: "Internet",
  insuranceAnnual: "Insurance",
  alarmAnnual: "Alarm",
  landscapingAnnual: "Landscaping",
  snowRemovalAnnual: "Snow removal",
  repairsAnnual: "Repairs",
  travelAnnual: "Travel",
  bookkeepingAnnual: "Bookkeeping",
  bankingAnnual: "Banking",
  securityAnnual: "Security",
  otherAnnual: "Other",
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
        title: "Running ownership costs",
        source: "ESTIMATE",
        lines: [
          { label: "Annual line items", value: lineTotal },
          { label: "Property fee (annual)", value: propertyFeeAnnual },
          { label: "Total annual", value: totalAnnual },
          { label: "Holding factor", value: `${params.holdingPeriodMonths} mo` },
          { label: "Cost over holding period", value: projectRunningCost },
        ],
      },
    ],
  };
}
