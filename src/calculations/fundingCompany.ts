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

  // Ägarlånets ränta har ett eget avdragsfält — delas inte med det externa
  // företagslånets deductibleInterestPercent, eftersom de kan träffas av
  // olika regler (t.ex. om ägarlånet är efterställt).
  const ownerLoanInterest = calculateInterest(
    funding.ownerLoanAmount,
    funding.ownerLoanInterestRate,
    holdingPeriodMonths,
  );
  const ownerLoanDeductibleInterest =
    ownerLoanInterest * (funding.ownerLoanDeductibleInterestPercent ?? 1);

  const totalEquityCommitted =
    (funding.companyCashInvested || 0) + (funding.shareholderContribution || 0);

  return {
    totalEquityCommitted,
    debt: funding.externalBusinessLoan || 0,
    businessInterest,
    deductibleInterest,
    fees,
    maxCashRequirement:
      totalEquityCommitted + (funding.externalBusinessLoan || 0) + (funding.ownerLoanAmount || 0),
    ownerLoanInterest,
    ownerLoanDeductibleInterest,
    audit: [
      {
        title: "Bolagets finansiering",
        source: "USER_INPUT",
        lines: [
          { label: "Pengar från bolagets kassa", value: funding.companyCashInvested || 0 },
          { label: "Aktieägartillskott", value: funding.shareholderContribution || 0 },
          { label: "Företagslån", value: funding.externalBusinessLoan || 0 },
          { label: "Ränta under innehavstiden", value: businessInterest },
          { label: "Varav avdragsgill", value: deductibleInterest },
          { label: "Uppläggning och borgensavgift", value: fees },
          { label: "Ägarlån", value: funding.ownerLoanAmount || 0 },
          { label: "Ränta på ägarlån under innehavstiden", value: ownerLoanInterest },
          { label: "Varav avdragsgill", value: ownerLoanDeductibleInterest },
        ],
      },
    ],
  };
}
