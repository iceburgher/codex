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
        title: "Company funding",
        source: "USER_INPUT",
        lines: [
          { label: "Company equity committed", value: funding.companyCashInvested || 0 },
          { label: "External business loan", value: funding.externalBusinessLoan || 0 },
          { label: "Interest over holding period", value: businessInterest },
          { label: "Deductible portion", value: deductibleInterest },
          { label: "Setup + guarantee fees", value: fees },
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
        title: "Project company funding",
        source: "USER_INPUT",
        lines: [
          { label: "Share capital", value: funding.shareCapital || 0 },
          { label: "Shareholder contribution", value: funding.shareholderContribution || 0 },
          { label: "Intercompany loan", value: funding.intercompanyLoan || 0 },
          { label: "Intercompany interest", value: intercompanyInterest },
          { label: "External loan", value: funding.externalLoan || 0 },
          { label: "External interest", value: externalInterest },
          { label: "Annual company admin cost (prorated)", value: adminCosts },
        ],
      },
    ],
  };
}
