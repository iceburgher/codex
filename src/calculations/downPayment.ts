import type { DownPaymentResult } from "@/types";

/**
 * Kontantinsatsen — hur mycket av köpeskillingen det primära lånet (bolån
 * privat, företagslån i bolag) högst får täcka. Säger ingenting om vad
 * resten faktiskt finansieras med: ett lån utan säkerhet (blancolån privat,
 * ägarlån i bolag) duger lika bra som eget kapital (privat eller från
 * bolaget) — det är upp till användaren att välja bland de källorna, den
 * här beräkningen flaggar bara om det PRIMÄRA lånet ensamt är för stort.
 */
export function calculateDownPayment(params: {
  purchasePrice: number;
  downPaymentRequirementPercent: number;
  primaryLoanAmount: number;
}): DownPaymentResult {
  const percent = Math.max(0, Math.min(1, params.downPaymentRequirementPercent || 0));
  const requiredDownPayment = params.purchasePrice * percent;
  const maxPrimaryLoan = Math.max(0, params.purchasePrice - requiredDownPayment);
  const primaryLoanAmount = params.primaryLoanAmount || 0;
  const shortfallAboveCap = Math.max(0, primaryLoanAmount - maxPrimaryLoan);
  const primaryLoanExceedsCap = shortfallAboveCap > 0.5;

  return {
    purchasePrice: params.purchasePrice,
    downPaymentRequirementPercent: percent,
    requiredDownPayment,
    maxPrimaryLoan,
    primaryLoanAmount,
    primaryLoanExceedsCap,
    shortfallAboveCap,
    audit: [
      {
        title: "Kontantinsats",
        source: "TAX_ADVISOR_INPUT",
        lines: [
          { label: "Köpeskilling", value: params.purchasePrice },
          { label: `Krävd kontantinsats, ${(percent * 100).toFixed(0)} %`, value: requiredDownPayment },
          { label: "Max primärt lån (bolån/företagslån)", value: maxPrimaryLoan },
          { label: "Primärt lån, ifyllt belopp", value: primaryLoanAmount },
          ...(primaryLoanExceedsCap
            ? [
                {
                  label: "Belopp över taket — måste finansieras på annat sätt",
                  value: shortfallAboveCap,
                },
              ]
            : []),
        ],
      },
    ],
  };
}
