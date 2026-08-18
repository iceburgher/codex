import type { CompanyAssetClassification, CorporateTaxResult } from "@/types";

/**
 * Company sale result. Deductible operating items (interest, running costs,
 * rental result, employer contributions on benefit) are folded into
 * `otherDeductibleResult` by the scenario adapter so the taxable result
 * reflects the whole project, not just the disposal.
 */
export function calculateCorporateTax(params: {
  salePrice: number;
  saleCosts: number;
  companyTaxBasis: number;
  otherDeductibleResult: number;
  corporateTaxRate: number;
  classification: CompanyAssetClassification;
}): CorporateTaxResult {
  const disposalResult = params.salePrice - params.saleCosts - params.companyTaxBasis;
  const taxableSaleResult = disposalResult + params.otherDeductibleResult;
  const companyTax = Math.max(0, taxableSaleResult) * params.corporateTaxRate;
  const companyProfitAfterTax = taxableSaleResult - companyTax;

  return {
    taxableSaleResult,
    companyTax,
    companyProfitAfterTax,
    audit: [
      {
        title: "Corporate tax",
        source: "VERIFIED",
        lines: [
          { label: "Sale price", value: params.salePrice },
          { label: "Sale costs", value: -params.saleCosts },
          { label: "Company tax basis", value: -params.companyTaxBasis },
          { label: "Disposal result", value: disposalResult },
          { label: "Other deductible project result", value: params.otherDeductibleResult },
          { label: "Taxable result", value: taxableSaleResult },
          { label: "Asset classification", value: params.classification },
          {
            label: `Corporate tax @ ${(params.corporateTaxRate * 100).toFixed(1)}%`,
            value: companyTax,
          },
          { label: "Profit after corporate tax", value: companyProfitAfterTax },
        ],
      },
    ],
  };
}
