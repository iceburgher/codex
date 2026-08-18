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
        title: "Renovering mot kapitalvinst",
        source: "TAX_ADVISOR_INPUT",
        lines: [
          { label: "Renovering totalt", value: renovationTotalGross },
          { label: "ROT-finansierat (räknas inte)", value: -rotDeduction },
          { label: "Kvar att klassificera", value: basisEligibleSpend },
          {
            label: `Grundförbättringar (${((split.fundamentalImprovementsPercent || 0) * 100).toFixed(0)} %)`,
            value: eligibleTaxBasis,
          },
          { label: "Ej avdragsgillt mot vinst", value: nonEligibleRenovation },
        ],
      },
    ],
  };
}
