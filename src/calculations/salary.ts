import type { SalaryInputs, SalaryResult } from "@/types";

export const SALARY_APPROXIMATION_WARNING =
  "Detta är en uppskattning. Den verkliga skatten på lön beror på kommun, total årslön, statlig inkomstskatt, avdrag och annat.";

export function calculateSalaryExtraction(params: {
  targetNetSalary: number;
  salary: SalaryInputs;
}): SalaryResult {
  const { targetNetSalary, salary } = params;
  const marginal = salary.effectiveMarginalIncomeTaxRate || 0;
  const employerRate = salary.employerContributionRate || 0;

  if (targetNetSalary <= 0) {
    return {
      grossSalary: 0,
      employerContribution: 0,
      companyCashCost: 0,
      companyCashCostPerPrivateSek: 0,
      audit: [],
    };
  }

  const grossSalary = marginal >= 1 ? 0 : targetNetSalary / (1 - marginal);
  const employerContribution = grossSalary * employerRate;
  const companyCashCost = grossSalary + employerContribution;
  const companyCashCostPerPrivateSek = companyCashCost / targetNetSalary;

  return {
    grossSalary,
    employerContribution,
    companyCashCost,
    companyCashCostPerPrivateSek,
    audit: [
      {
        title: "Lön till ägarna",
        source: "TAX_ADVISOR_INPUT",
        lines: [
          { label: "Önskad lön netto", value: targetNetSalary },
          { label: `Inkomstskatt, ${(marginal * 100).toFixed(1).replace(".", ",")} %`, value: grossSalary - targetNetSalary },
          { label: "Bruttolön", value: grossSalary },
          { label: `Arbetsgivaravgifter, ${(employerRate * 100).toFixed(2).replace(".", ",")} %`, value: employerContribution },
          { label: "Bolagets kostnad", value: companyCashCost },
          {
            label: "Bolagets kostnad per krona privat",
            value: `${companyCashCostPerPrivateSek.toFixed(2).replace(".", ",")} kr`,
          },
        ],
      },
    ],
  };
}
