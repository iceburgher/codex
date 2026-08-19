import type { LoanResult, PrivateLoanInputs } from "@/types";

/** Simple (non-amortizing) interest over the holding period. */
export function calculateInterest(
  principal: number,
  annualRate: number,
  holdingPeriodMonths: number,
): number {
  return (principal || 0) * (annualRate || 0) * (holdingPeriodMonths / 12);
}

/**
 * Skattereduktion för underskott av kapital är trappad, inte platt: 30 % upp
 * till 100 000 kr per person, 21 % på det som ligger över. Två ägare med
 * hälften var av räntan får alltså dubbla tröskeln innan den lägre satsen
 * slår in — approximerat här som en gemensam tröskel för hela räntebeloppet
 * (100 000 kr x antal ägare) snarare än en fullständig per-person-uppdelning
 * av hela kalkylen.
 */
export function calculateTieredInterestDeduction(params: {
  grossInterest: number;
  numberOfOwners: number;
  tier1Rate: number;
  tier2Rate: number;
  thresholdPerPerson: number;
}): number {
  const threshold = params.thresholdPerPerson * Math.max(1, params.numberOfOwners);
  const tier1Base = Math.min(params.grossInterest, threshold);
  const tier2Base = Math.max(0, params.grossInterest - threshold);
  return tier1Base * params.tier1Rate + tier2Base * params.tier2Rate;
}

export function calculatePrivateLoans(params: {
  loans: PrivateLoanInputs;
  holdingPeriodMonths: number;
  numberOfOwners: number;
  securedLoanInterestDeductionRateTier2: number;
  securedLoanInterestDeductionThresholdPerPerson: number;
}): LoanResult {
  const { loans, holdingPeriodMonths, numberOfOwners } = params;

  const grossMortgageInterest = calculateInterest(
    loans.mortgageAmount,
    loans.mortgageInterestRate,
    holdingPeriodMonths,
  );
  const mortgageTaxReduction = calculateTieredInterestDeduction({
    grossInterest: grossMortgageInterest,
    numberOfOwners,
    tier1Rate: loans.securedLoanInterestDeductionRate || 0,
    tier2Rate: params.securedLoanInterestDeductionRateTier2,
    thresholdPerPerson: params.securedLoanInterestDeductionThresholdPerPerson,
  });
  const netMortgageInterest = grossMortgageInterest - mortgageTaxReduction;

  const grossUnsecuredInterest = calculateInterest(
    loans.unsecuredLoanAmount,
    loans.unsecuredInterestRate,
    holdingPeriodMonths,
  );
  const unsecuredTaxReduction =
    grossUnsecuredInterest * (loans.unsecuredLoanInterestDeductionRate || 0);
  const netUnsecuredInterest = grossUnsecuredInterest - unsecuredTaxReduction;

  // Lån från ett eget/närstående bolag är inte säkerställt i huset, så det
  // följer samma avdragsrätt som ett vanligt blancolån.
  const grossCompanyLoanInterest = calculateInterest(
    loans.companyLoanAmount,
    loans.companyLoanInterestRate,
    holdingPeriodMonths,
  );
  const companyLoanTaxReduction =
    grossCompanyLoanInterest * (loans.unsecuredLoanInterestDeductionRate || 0);
  const netCompanyLoanInterest = grossCompanyLoanInterest - companyLoanTaxReduction;

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
    grossCompanyLoanInterest,
    companyLoanTaxReduction,
    netCompanyLoanInterest,
    totalSetupFees,
    totalAmortization,
    audit: [
      {
        title: "Privat räntekostnad",
        source: "USER_INPUT",
        lines: [
          { label: "Bolåneränta före avdrag", value: grossMortgageInterest },
          {
            label: `Ränteavdrag (${(numberOfOwners * params.securedLoanInterestDeductionThresholdPerPerson).toLocaleString("sv-SE")} kr @ ${((loans.securedLoanInterestDeductionRate || 0) * 100).toFixed(0)} %, resten @ ${(params.securedLoanInterestDeductionRateTier2 * 100).toFixed(0)} %)`,
            value: -mortgageTaxReduction,
          },
          { label: "Bolåneränta efter avdrag", value: netMortgageInterest },
          { label: "Privatlåneränta före avdrag", value: grossUnsecuredInterest },
          { label: "Ränteavdrag privatlån", value: -unsecuredTaxReduction },
          { label: "Privatlåneränta efter avdrag", value: netUnsecuredInterest },
          { label: "Ränta på lån från eget bolag, före avdrag", value: grossCompanyLoanInterest },
          { label: "Ränteavdrag, lån från eget bolag", value: -companyLoanTaxReduction },
          { label: "Ränta på lån från eget bolag, efter avdrag", value: netCompanyLoanInterest },
          { label: "Uppläggningsavgifter", value: totalSetupFees },
          { label: "Amortering (kassaflöde, ej kostnad)", value: totalAmortization },
        ],
      },
    ],
  };
}
