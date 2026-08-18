import type { RentalInputs, RentalResult } from "@/types";

export const SHORT_TERM_RENTAL_WARNING =
  "Mycket korttidsuthyrning kan likna hotellverksamhet, vilket ändrar både moms och inkomstbeskattning. Stäm av med skatterådgivare.";

export function calculateRental(params: {
  rental: RentalInputs;
  holdingPeriodMonths: number;
  isPrivateOwned: boolean;
  rentalStandardDeduction: number;
  rentalPercentDeduction: number;
  capitalIncomeTaxRate: number;
}): RentalResult {
  const { rental, holdingPeriodMonths, isPrivateOwned } = params;

  if (!rental.enabled) {
    return {
      grossRentalIncome: 0,
      standardDeduction: 0,
      percentDeduction: 0,
      privateTaxableRentalSurplus: 0,
      privateRentalTax: 0,
      deductibleRentalCosts: 0,
      companyRentalProfit: 0,
      netRentalCashPrivate: 0,
      netRentalCashCompany: 0,
      audit: [],
    };
  }

  const ownershipFractionOfYear = Math.min(1, holdingPeriodMonths / 12);
  const grossRentalIncome = (rental.rentedWeeks || 0) * (rental.rentPerWeek || 0);

  const platformFee = grossRentalIncome * (rental.platformFeePercent || 0);
  const cleaning = (rental.cleaningPerStay || 0) * (rental.numberOfStays || 0);
  const deductibleRentalCosts =
    platformFee + cleaning + (rental.extraUtilities || 0) + (rental.extraWearAndTear || 0);

  const standardDeduction = params.rentalStandardDeduction * ownershipFractionOfYear;
  const percentDeduction = grossRentalIncome * params.rentalPercentDeduction;
  const privateTaxableRentalSurplus = Math.max(
    0,
    grossRentalIncome - standardDeduction - percentDeduction,
  );
  const privateRentalTax = privateTaxableRentalSurplus * params.capitalIncomeTaxRate;

  const companyRentalProfit = grossRentalIncome - deductibleRentalCosts;

  const netRentalCashPrivate = grossRentalIncome - deductibleRentalCosts - privateRentalTax;
  const netRentalCashCompany = companyRentalProfit;

  const warning =
    (rental.numberOfStays || 0) >= 10 || (rental.rentedWeeks || 0) >= 16
      ? SHORT_TERM_RENTAL_WARNING
      : undefined;

  return {
    grossRentalIncome,
    standardDeduction,
    percentDeduction,
    privateTaxableRentalSurplus,
    privateRentalTax,
    deductibleRentalCosts,
    companyRentalProfit,
    netRentalCashPrivate,
    netRentalCashCompany,
    warning,
    audit: [
      {
        title: isPrivateOwned ? "Skatt på privat uthyrning" : "Uthyrningsresultat i bolaget",
        source: "VERIFIED",
        lines: isPrivateOwned
          ? [
              { label: "Hyresintäkter", value: grossRentalIncome },
              { label: "Schablonavdrag", value: -standardDeduction },
              { label: "Procentavdrag", value: -percentDeduction },
              { label: "Skattepliktigt överskott", value: privateTaxableRentalSurplus },
              {
                label: `Kapitalskatt, ${(params.capitalIncomeTaxRate * 100).toFixed(0)} %`,
                value: privateRentalTax,
              },
              { label: "Direkta uthyrningskostnader", value: deductibleRentalCosts },
              { label: "Netto från uthyrning", value: netRentalCashPrivate },
            ]
          : [
              { label: "Hyresintäkter", value: grossRentalIncome },
              { label: "Avdragsgilla kostnader", value: -deductibleRentalCosts },
              { label: "Resultat till bolaget", value: companyRentalProfit },
            ],
      },
    ],
  };
}
