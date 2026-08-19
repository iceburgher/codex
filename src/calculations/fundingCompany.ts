import type { CompanyFundingInputs, CompanyFundingResult } from "@/types";
import { calculateInterest } from "./loans";

export function calculateCompanyFunding(params: {
  funding: CompanyFundingInputs;
  holdingPeriodMonths: number;
}): CompanyFundingResult {
  const { funding, holdingPeriodMonths } = params;

  const businessInterest = calculateInterest(
    funding.externalBusinessLoan,
    funding.businessInterestRate,
    holdingPeriodMonths,
  );
  const deductibleInterest = businessInterest * (funding.deductibleInterestPercent ?? 1);
  const fees = (funding.setupFee || 0) + (funding.guaranteeFee || 0);

  return {
    totalEquityCommitted: funding.companyCashInvested || 0,
    debt: funding.externalBusinessLoan || 0,
    businessInterest,
    deductibleInterest,
    fees,
    maxCashRequirement: (funding.companyCashInvested || 0) + (funding.externalBusinessLoan || 0),
    audit: [
      {
        title: "Bolagets finansiering",
        source: "USER_INPUT",
        lines: [
          { label: "Eget kapital från bolaget", value: funding.companyCashInvested || 0 },
          { label: "Företagslån", value: funding.externalBusinessLoan || 0 },
          { label: "Ränta under innehavstiden", value: businessInterest },
          { label: "Varav avdragsgill", value: deductibleInterest },
          { label: "Uppläggning och borgensavgift", value: fees },
        ],
      },
    ],
  };
}
