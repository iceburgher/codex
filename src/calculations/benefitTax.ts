import type { BenefitInputs, BenefitResult, PrivateUseLevel } from "@/types";

const PRIVATE_USE_LABELS: Record<PrivateUseLevel, string> = {
  none: "Ingen",
  occasional: "Enstaka tillfällen",
  frequent: "Ofta",
  full_disposition: "Full dispositionsrätt",
};

export const BENEFIT_WARNING =
  "Förmånsbeskattning kan utgå från själva dispositionsrätten, inte bara de dagar huset faktiskt används. Ta in skatteråd innan du litar på det här alternativet.";

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
        title: "Förmånsbeskattning vid privat användning",
        source: "TAX_ADVISOR_INPUT",
        lines: [
          { label: "Grad av privat användning", value: PRIVATE_USE_LABELS[privateUseLevel] },
          {
            label: "Marknadsmässigt förmånsvärde per år",
            value: benefit.estimatedAnnualMarketBenefitValue || 0,
          },
          { label: "Förmånsvärde under perioden", value: proratedBenefitValue },
          { label: "Ägarens skattekostnad", value: ownerBenefitTax },
          { label: "Arbetsgivaravgift för bolaget", value: companyEmployerContributionOnBenefit },
          { label: "Total ekonomisk kostnad", value: combinedEconomicCost },
        ],
      },
    ],
  };
}
