import type {
  CompanyFundingInputs,
  CompanyFundingResult,
  ProjectCompanyFundingInputs,
} from "@/types";
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

export function calculateProjectCompanyFunding(params: {
  funding: ProjectCompanyFundingInputs;
  holdingPeriodMonths: number;
}): CompanyFundingResult {
  const { funding, holdingPeriodMonths } = params;
  const holdingFactor = holdingPeriodMonths / 12;

  const intercompanyInterest = calculateInterest(
    funding.intercompanyLoan,
    funding.intercompanyInterestRate,
    holdingPeriodMonths,
  );
  const externalInterest = calculateInterest(
    funding.externalLoan,
    funding.externalInterestRate,
    holdingPeriodMonths,
  );
  const businessInterest = intercompanyInterest + externalInterest;

  const adminCosts =
    ((funding.annualAccountingCost || 0) +
      (funding.annualBankingCost || 0) +
      (funding.annualAdminCost || 0)) *
    holdingFactor;

  const equity = (funding.shareCapital || 0) + (funding.shareholderContribution || 0);
  const debt = (funding.intercompanyLoan || 0) + (funding.externalLoan || 0);

  return {
    totalEquityCommitted: equity,
    debt,
    businessInterest,
    deductibleInterest: businessInterest,
    fees: adminCosts,
    maxCashRequirement: equity + debt,
    audit: [
      {
        title: "Projektbolagets finansiering",
        source: "USER_INPUT",
        lines: [
          { label: "Aktiekapital", value: funding.shareCapital || 0 },
          { label: "Aktieägartillskott", value: funding.shareholderContribution || 0 },
          { label: "Koncernlån", value: funding.intercompanyLoan || 0 },
          { label: "Ränta koncernlån", value: intercompanyInterest },
          { label: "Externt lån", value: funding.externalLoan || 0 },
          { label: "Ränta externt lån", value: externalInterest },
          { label: "Bolagsadministration under perioden", value: adminCosts },
        ],
      },
    ],
  };
}
