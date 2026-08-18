import type { CapitalGainResult, PrivatePropertyTaxClassification } from "@/types";

const CLASSIFICATION_LABELS: Record<PrivatePropertyTaxClassification, string> = {
  private_residential_property: "Privatbostad",
  business_property: "Näringsfastighet",
  property_trading_inventory_risk: "Risk för handel med fastigheter",
};

/**
 * Private capital gain. The 22% effective residential rate is applied ONLY
 * when the user has explicitly classified the property as a private
 * residential property. Other classifications fall back to a user-supplied
 * rate, defaulting to the full capital income rate, and are flagged.
 */
export function calculatePrivateCapitalGain(params: {
  salePrice: number;
  saleCosts: number;
  purchasePrice: number;
  eligiblePurchaseCosts: number;
  eligibleImprovementCosts: number;
  classification: PrivatePropertyTaxClassification;
  privateResidentialEffectiveRate: number;
  fallbackRate: number;
}): CapitalGainResult {
  const taxBasis =
    params.purchasePrice + params.eligiblePurchaseCosts + params.eligibleImprovementCosts;
  const capitalGain = params.salePrice - params.saleCosts - taxBasis;

  const rate =
    params.classification === "private_residential_property"
      ? params.privateResidentialEffectiveRate
      : params.fallbackRate;

  const capitalGainTax = Math.max(0, capitalGain) * rate;

  return {
    taxBasis,
    capitalGain,
    capitalGainTax,
    classificationApplied: params.classification,
    audit: [
      {
        title: "Kapitalvinst privat",
        source:
          params.classification === "private_residential_property"
            ? "VERIFIED"
            : "TAX_ADVISOR_INPUT",
        lines: [
          { label: "Försäljningspris", value: params.salePrice },
          { label: "Försäljningskostnader", value: -params.saleCosts },
          { label: "Köpeskilling", value: -params.purchasePrice },
          { label: "Avdragsgilla köpkostnader", value: -params.eligiblePurchaseCosts },
          { label: "Avdragsgilla förbättringar", value: -params.eligibleImprovementCosts },
          { label: "Kapitalvinst", value: capitalGain },
          { label: "Klassificering", value: CLASSIFICATION_LABELS[params.classification] },
          { label: "Skattesats", value: `${(rate * 100).toFixed(1).replace(".", ",")} %` },
          { label: "Kapitalvinstskatt", value: capitalGainTax },
        ],
      },
    ],
  };
}
