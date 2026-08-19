import type { CompanyAssetClassification, CorporateTaxResult } from "@/types";

const ASSET_LABELS: Record<CompanyAssetClassification, string> = {
  capital_asset: "Kapitaltillgång",
  inventory_property: "Lagerfastighet",
};

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
  // Ett underskott ger ingen skatteåterbäring nu — bara ett sparat avdrag
  // (rullas framåt) värt det här OM bolaget någon gång har annan vinst att
  // kvitta det mot. Räknas inte in i companyProfitAfterTax av det skälet.
  const deferredTaxAssetValue = Math.max(0, -taxableSaleResult) * params.corporateTaxRate;

  return {
    taxableSaleResult,
    companyTax,
    companyProfitAfterTax,
    deferredTaxAssetValue,
    audit: [
      {
        title: "Bolagsskatt",
        source: "VERIFIED",
        lines: [
          { label: "Försäljningspris", value: params.salePrice },
          { label: "Försäljningskostnader", value: -params.saleCosts },
          { label: "Skattemässigt anskaffningsvärde", value: -params.companyTaxBasis },
          { label: "Resultat vid försäljning", value: disposalResult },
          { label: "Övrigt projektresultat", value: params.otherDeductibleResult },
          { label: "Skattepliktigt resultat", value: taxableSaleResult },
          { label: "Klassificering", value: ASSET_LABELS[params.classification] },
          {
            label: `Bolagsskatt, ${(params.corporateTaxRate * 100).toFixed(1).replace(".", ",")} %`,
            value: companyTax,
          },
          { label: "Vinst efter bolagsskatt", value: companyProfitAfterTax },
          ...(deferredTaxAssetValue > 0
            ? [
                {
                  label: "Sparat underskott, värde om det kvittas mot annan vinst (ej intäktsfört)",
                  value: deferredTaxAssetValue,
                },
              ]
            : []),
        ],
      },
    ],
  };
}
