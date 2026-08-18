import type { LoanResult, PrivateLoanInputs } from "@/types";

/** Simple (non-amortizing) interest over the holding period. */
export function calculateInterest(
  principal: number,
  annualRate: number,
  holdingPeriodMonths: number,
): number {
  return (principal || 0) * (annualRate || 0) * (holdingPeriodMonths / 12);
}

export function calculatePrivateLoans(params: {
  loans: PrivateLoanInputs;
  holdingPeriodMonths: number;
}): LoanResult {
  const { loans, holdingPeriodMonths } = params;

  const grossMortgageInterest = calculateInterest(
    loans.mortgageAmount,
    loans.mortgageInterestRate,
    holdingPeriodMonths,
  );
  const mortgageTaxReduction =
    grossMortgageInterest * (loans.securedLoanInterestDeductionRate || 0);
  const netMortgageInterest = grossMortgageInterest - mortgageTaxReduction;

  const grossUnsecuredInterest = calculateInterest(
    loans.unsecuredLoanAmount,
    loans.unsecuredInterestRate,
    holdingPeriodMonths,
  );
  const unsecuredTaxReduction =
    grossUnsecuredInterest * (loans.unsecuredLoanInterestDeductionRate || 0);
  const netUnsecuredInterest = grossUnsecuredInterest - unsecuredTaxReduction;

  const totalSetupFees = (loans.mortgageSetupFee || 0) + (loans.unsecuredSetupFee || 0);
  const totalAmortization =
    ((loans.mortgageAmortizationAnnual || 0) + (loans.unsecuredAmortizationAnnual || 0)) *
    (holdingPeriodMonths / 12);

  return {
    grossMortgageInterest,
    mortgageTaxReduction,
    netMortgageInterest,
    grossUnsecuredInterest,
    unsecuredTaxReduction,
    netUnsecuredInterest,
    totalSetupFees,
    totalAmortization,
    audit: [
      {
        title: "Private financing cost",
        source: "USER_INPUT",
        lines: [
          { label: "Mortgage interest (gross)", value: grossMortgageInterest },
          { label: "Mortgage interest tax reduction", value: -mortgageTaxReduction },
          { label: "Mortgage interest (net)", value: netMortgageInterest },
          { label: "Unsecured interest (gross)", value: grossUnsecuredInterest },
          { label: "Unsecured interest tax reduction", value: -unsecuredTaxReduction },
          { label: "Unsecured interest (net)", value: netUnsecuredInterest },
          { label: "Setup fees", value: totalSetupFees },
          { label: "Amortization (cash flow, not project expense)", value: totalAmortization },
        ],
      },
    ],
  };
}
