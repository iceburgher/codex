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
        title: "Privat räntekostnad",
        source: "USER_INPUT",
        lines: [
          { label: "Bolåneränta före avdrag", value: grossMortgageInterest },
          { label: "Ränteavdrag", value: -mortgageTaxReduction },
          { label: "Bolåneränta efter avdrag", value: netMortgageInterest },
          { label: "Privatlåneränta före avdrag", value: grossUnsecuredInterest },
          { label: "Ränteavdrag privatlån", value: -unsecuredTaxReduction },
          { label: "Privatlåneränta efter avdrag", value: netUnsecuredInterest },
          { label: "Uppläggningsavgifter", value: totalSetupFees },
          { label: "Amortering (kassaflöde, ej kostnad)", value: totalAmortization },
        ],
      },
    ],
  };
}
