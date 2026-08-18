import type { CapitalGainResult, PrivatePropertyTaxClassification } from "@/types";

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
        title: "Private capital gain",
        source:
          params.classification === "private_residential_property"
            ? "VERIFIED"
            : "TAX_ADVISOR_INPUT",
        lines: [
          { label: "Sale price", value: params.salePrice },
          { label: "Sale costs", value: -params.saleCosts },
          { label: "Purchase price", value: -params.purchasePrice },
          { label: "Eligible purchase costs", value: -params.eligiblePurchaseCosts },
          { label: "Eligible improvement costs", value: -params.eligibleImprovementCosts },
          { label: "Capital gain", value: capitalGain },
          { label: "Classification", value: params.classification },
          { label: `Rate applied`, value: `${(rate * 100).toFixed(1)}%` },
          { label: "Capital gain tax", value: capitalGainTax },
        ],
      },
    ],
  };
}
