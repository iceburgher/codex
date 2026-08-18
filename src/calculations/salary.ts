import type { SalaryInputs, SalaryResult } from "@/types";

export const SALARY_APPROXIMATION_WARNING =
  "This is an approximation. Exact salary taxation can depend on municipality, total annual salary, state income tax, deductions and other factors.";

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
        title: "Salary extraction",
        source: "TAX_ADVISOR_INPUT",
        lines: [
          { label: "Target net salary", value: targetNetSalary },
          { label: `Marginal income tax ${(marginal * 100).toFixed(1)}%`, value: grossSalary - targetNetSalary },
          { label: "Gross salary", value: grossSalary },
          { label: `Employer contributions ${(employerRate * 100).toFixed(2)}%`, value: employerContribution },
          { label: "Company cash cost", value: companyCashCost },
          {
            label: "Company cash cost per private SEK",
            value: `${companyCashCostPerPrivateSek.toFixed(2)}x`,
          },
        ],
      },
    ],
  };
}
