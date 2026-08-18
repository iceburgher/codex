import type { ImprovementBasisResult, ImprovementTaxBasisInputs } from "@/types";

/**
 * Splits renovation spend into what may be added to the capital-gains tax
 * basis and what may not. ROT-funded amounts are always excluded from the
 * eligible basis (spec section 11 & 24).
 */
export function calculateImprovementBasis(params: {
  renovationTotalGross: number;
  rotDeduction: number;
  split: ImprovementTaxBasisInputs;
}): ImprovementBasisResult {
  const { renovationTotalGross, rotDeduction, split } = params;

  const basisEligibleSpend = Math.max(0, renovationTotalGross - rotDeduction);
  const eligibleTaxBasis = basisEligibleSpend * (split.fundamentalImprovementsPercent || 0);
  const nonEligibleRenovation = renovationTotalGross - eligibleTaxBasis;

  return {
    renovationTotal: renovationTotalGross,
    eligibleTaxBasis,
    nonEligibleRenovation,
    audit: [
      {
        title: "Improvement cost classification",
        source: "TAX_ADVISOR_INPUT",
        lines: [
          { label: "Renovation total (gross)", value: renovationTotalGross },
          { label: "ROT-funded (excluded from basis)", value: -rotDeduction },
          { label: "Spend available for classification", value: basisEligibleSpend },
          {
            label: `Fundamental improvements (${((split.fundamentalImprovementsPercent || 0) * 100).toFixed(0)}%)`,
            value: eligibleTaxBasis,
          },
          { label: "Not eligible against capital gain", value: nonEligibleRenovation },
        ],
      },
    ],
  };
}
