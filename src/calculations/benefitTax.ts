import type { BenefitInputs, BenefitResult, PrivateUseLevel } from "@/types";

export const BENEFIT_WARNING =
  "Benefit taxation may be based on the right to use the property, not only actual days used. Obtain tax advice before relying on this scenario.";

/**
 * Benefit (förmånsbeskattning) for a company-owned property available for the
 * owners' private use. The market benefit value is never inferred — it is
 * always a manual/advisor input.
 */
export function calculateBenefitTax(params: {
  benefit: BenefitInputs;
  privateUseLevel: PrivateUseLevel;
  holdingPeriodMonths: number;
  isCompanyOwned: boolean;
}): BenefitResult {
  const { benefit, privateUseLevel, holdingPeriodMonths, isCompanyOwned } = params;

  if (!isCompanyOwned || privateUseLevel === "none") {
    return {
      proratedBenefitValue: 0,
      ownerBenefitTax: 0,
      companyEmployerContributionOnBenefit: 0,
      combinedEconomicCost: 0,
      audit: [],
    };
  }

  const proratedBenefitValue =
    (benefit.estimatedAnnualMarketBenefitValue || 0) * (holdingPeriodMonths / 12);
  const ownerBenefitTax = proratedBenefitValue * (benefit.ownerIncomeTaxRateOnBenefit || 0);
  const companyEmployerContributionOnBenefit =
    proratedBenefitValue * (benefit.employerContributionRate || 0);
  const combinedEconomicCost = ownerBenefitTax + companyEmployerContributionOnBenefit;

  return {
    proratedBenefitValue,
    ownerBenefitTax,
    companyEmployerContributionOnBenefit,
    combinedEconomicCost,
    audit: [
      {
        title: "Private use benefit taxation",
        source: "TAX_ADVISOR_INPUT",
        lines: [
          { label: "Private use level", value: privateUseLevel },
          {
            label: "Annual market benefit value",
            value: benefit.estimatedAnnualMarketBenefitValue || 0,
          },
          { label: "Prorated benefit value", value: proratedBenefitValue },
          { label: "Owner tax cost", value: ownerBenefitTax },
          { label: "Company payroll cost", value: companyEmployerContributionOnBenefit },
          { label: "Combined economic cost", value: combinedEconomicCost },
        ],
      },
    ],
  };
}
