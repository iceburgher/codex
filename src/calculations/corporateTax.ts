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
 *
 * Vid en andelsförsäljning (paketering, `disposalTaxExempt`) är själva
 * försäljningsresultatet skattefritt i bolaget (IL 25a, näringsbetingade
 * andelar) — men det löpande projektresultatet (ränta, drift, uthyrning,
 * förmånens arbetsgivaravgift) har inte med aktieaffären att göra och
 * beskattas som vanligt.
 */
export function calculateCorporateTax(params: {
  salePrice: number;
  saleCosts: number;
  companyTaxBasis: number;
  otherDeductibleResult: number;
  corporateTaxRate: number;
  classification: CompanyAssetClassification;
  disposalTaxExempt: boolean;
}): CorporateTaxResult {
  const disposalResult = params.salePrice - params.saleCosts - params.companyTaxBasis;
  const totalResult = disposalResult + params.otherDeductibleResult;
  const taxableResult = params.disposalTaxExempt ? params.otherDeductibleResult : totalResult;

  const companyTax = Math.max(0, taxableResult) * params.corporateTaxRate;
  const companyProfitAfterTax = totalResult - companyTax;
  // Ett underskott ger ingen skatteåterbäring nu — bara ett sparat avdrag
  // (rullas framåt) värt det här OM bolaget någon gång har annan vinst att
  // kvitta det mot. Räknas inte in i companyProfitAfterTax av det skälet.
  const deferredTaxAssetValue = Math.max(0, -taxableResult) * params.corporateTaxRate;

  return {
    taxableSaleResult: taxableResult,
    companyTax,
    companyProfitAfterTax,
    deferredTaxAssetValue,
    audit: [
      {
        title: params.disposalTaxExempt ? "Bolagsskatt (paketering — andelsförsäljning)" : "Bolagsskatt",
        source: params.disposalTaxExempt ? "TAX_ADVISOR_INPUT" : "VERIFIED",
        lines: [
          { label: "Försäljningspris (efter ev. köparrabatt)", value: params.salePrice },
          { label: "Försäljningskostnader", value: -params.saleCosts },
          { label: "Skattemässigt anskaffningsvärde", value: -params.companyTaxBasis },
          {
            label: params.disposalTaxExempt
              ? "Resultat vid försäljning (skattefritt, IL 25a)"
              : "Resultat vid försäljning",
            value: disposalResult,
          },
          { label: "Övrigt projektresultat (beskattas alltid)", value: params.otherDeductibleResult },
          { label: "Totalt ekonomiskt resultat", value: totalResult },
          { label: "Skattepliktigt resultat", value: taxableResult },
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
