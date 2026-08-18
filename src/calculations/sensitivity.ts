import type { PropertyProject, ScenarioType } from "@/types";
import { calculateScenario, type ScenarioOverrides } from "./engine";

export type SensitivityMetric = "after_tax_profit" | "equity_roi" | "family_net_worth";

export interface SensitivityCell {
  rowLabel: string;
  columnLabel: string;
  renovationMultiplier: number;
  salePriceMultiplier: number;
  value: number;
}

export interface SensitivityMatrix {
  metric: SensitivityMetric;
  rows: string[];
  columns: string[];
  cells: SensitivityCell[][];
}

const DEFAULT_RENOVATION_STEPS = [-0.1, 0, 0.2];
const DEFAULT_SALE_STEPS = [-0.1, 0, 0.1];

export function buildSensitivityMatrix(params: {
  project: PropertyProject;
  scenario: ScenarioType;
  metric: SensitivityMetric;
  renovationSteps?: number[];
  salePriceSteps?: number[];
  baseOverrides?: ScenarioOverrides;
}): SensitivityMatrix {
  const renovationSteps = params.renovationSteps ?? DEFAULT_RENOVATION_STEPS;
  const salePriceSteps = params.salePriceSteps ?? DEFAULT_SALE_STEPS;
  const baseSalePrice = params.project.inputs.expectedSalePrice ?? 0;

  const rows = renovationSteps.map(stepLabel("Renovation"));
  const columns = salePriceSteps.map(stepLabel("Sale price"));

  const cells = renovationSteps.map((rStep, ri) =>
    salePriceSteps.map((sStep, ci) => {
      const result = calculateScenario(params.project, params.scenario, {
        ...params.baseOverrides,
        renovationMultiplier: (params.baseOverrides?.renovationMultiplier ?? 1) * (1 + rStep),
        salePrice: baseSalePrice * (1 + sStep),
      });

      const value =
        params.metric === "after_tax_profit"
          ? result.netAvailablePrivately
          : params.metric === "equity_roi"
            ? result.roi.equityROI
            : result.familyNetWorth.familyNetWorthDeltaModeB;

      return {
        rowLabel: rows[ri],
        columnLabel: columns[ci],
        renovationMultiplier: 1 + rStep,
        salePriceMultiplier: 1 + sStep,
        value,
      };
    }),
  );

  return { metric: params.metric, rows, columns, cells };
}

function stepLabel(prefix: string) {
  return (step: number) =>
    step === 0 ? `${prefix} base` : `${prefix} ${step > 0 ? "+" : ""}${Math.round(step * 100)}%`;
}

export interface SensitivitySweepPoint {
  label: string;
  value: number;
  netProfit: number;
  equityROI: number;
}

/** One-dimensional sweep used by the sensitivity sliders. */
export function sweep(params: {
  project: PropertyProject;
  scenario: ScenarioType;
  variable: "purchasePrice" | "renovation" | "salePrice" | "interestRate" | "holdingPeriod";
  steps: number[];
}): SensitivitySweepPoint[] {
  const { project, scenario, variable, steps } = params;
  const basePurchase = project.inputs.purchasePrice ?? 0;
  const baseSale = project.inputs.expectedSalePrice ?? 0;

  return steps.map((step) => {
    let overrides: ScenarioOverrides = {};
    let label = "";
    let value = step;

    switch (variable) {
      case "purchasePrice":
        overrides = { purchasePrice: basePurchase * (1 + step) };
        label = `${step > 0 ? "+" : ""}${Math.round(step * 100)}%`;
        value = basePurchase * (1 + step);
        break;
      case "renovation":
        overrides = { renovationMultiplier: 1 + step };
        label = `${step > 0 ? "+" : ""}${Math.round(step * 100)}%`;
        break;
      case "salePrice":
        overrides = { salePrice: baseSale * (1 + step) };
        label = `${step > 0 ? "+" : ""}${Math.round(step * 100)}%`;
        value = baseSale * (1 + step);
        break;
      case "interestRate":
        overrides = { interestRateDelta: step };
        label = `${step > 0 ? "+" : ""}${(step * 100).toFixed(1)} pp`;
        break;
      case "holdingPeriod":
        overrides = { holdingPeriodMonths: step };
        label = `${step} mo`;
        break;
    }

    const result = calculateScenario(project, scenario, overrides);
    return {
      label,
      value,
      netProfit: result.netAvailablePrivately,
      equityROI: result.roi.equityROI,
    };
  });
}
