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

  const aboveAllowanceRateMissing =
    dist.aboveAllowanceGross > 0 &&
    (dividend.dividendTaxAboveAllowance === null ||
      dividend.dividendTaxAboveAllowance === undefined);

  return {
    aboveAllowanceRateMissing,
    companyProfitAfterTax,
    withinDividendAllowance: dist.withinAllowanceGross,
    aboveDividendAllowance: dist.aboveAllowanceGross,
    retainedInCompany,
    ownerExtractionTax: dist.dividendTax,
    netPrivateFromCompanyProfit: dist.netCashToOwner,
    audit: [
      {
        title: "Att få ut pengarna ur bolaget",
        source: "TAX_ADVISOR_INPUT",
        lines: [
          { label: "Vinst efter bolagsskatt", value: companyProfitAfterTax },
          { label: `Delas ut (${(share * 100).toFixed(0)} %)`, value: distributable },
          { label: "Inom gränsbelopp", value: dist.withinAllowanceGross },
          { label: "Över gränsbelopp", value: dist.aboveAllowanceGross },
          { label: "Skatt för ägarna", value: dist.dividendTax },
          { label: "Netto privat", value: dist.netCashToOwner },
          { label: "Kvar i bolaget", value: retainedInCompany },
        ],
      },
    ],
  };
}
