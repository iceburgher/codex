import type { DividendInputs, ExtractionResult } from "@/types";
import { distributeDividend } from "./dividend";

/**
 * Second tax layer — the cost of moving company profit out to the owners.
 * `extractionShare` lets the user model partial distribution; the remainder
 * stays inside the company and is NOT treated as private cash.
 */
export function calculateExtraction(params: {
  companyProfitAfterTax: number;
  dividend: DividendInputs;
  extractionShare: number; // 0..1
}): ExtractionResult {
  const { companyProfitAfterTax, dividend } = params;
  const share = Math.min(1, Math.max(0, params.extractionShare));
  const distributable = Math.max(0, companyProfitAfterTax) * share;
  const retainedInCompany = companyProfitAfterTax - distributable;

  const dist = distributeDividend({ grossAvailable: distributable, dividend });

  return {
    companyProfitAfterTax,
    withinDividendAllowance: dist.withinAllowanceGross,
    aboveDividendAllowance: dist.aboveAllowanceGross,
    retainedInCompany,
    ownerExtractionTax: dist.dividendTax,
    netPrivateFromCompanyProfit: dist.netCashToOwner,
    audit: [
      {
        title: "Money leaving the company",
        source: "TAX_ADVISOR_INPUT",
        lines: [
          { label: "Profit after corporate tax", value: companyProfitAfterTax },
          { label: `Distributed (${(share * 100).toFixed(0)}%)`, value: distributable },
          { label: "Within dividend allowance", value: dist.withinAllowanceGross },
          { label: "Above dividend allowance", value: dist.aboveAllowanceGross },
          { label: "Owner extraction tax", value: dist.dividendTax },
          { label: "Net private from company profit", value: dist.netCashToOwner },
          { label: "Retained in company", value: retainedInCompany },
        ],
      },
    ],
  };
}
