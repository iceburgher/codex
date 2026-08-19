import type { CapitalGainResult, PrivatePropertyTaxClassification } from "@/types";

const CLASSIFICATION_LABELS: Record<PrivatePropertyTaxClassification, string> = {
  private_residential_property: "Privatbostad",
  business_property: "Näringsfastighet",
  property_trading_inventory_risk: "Risk för handel med fastigheter",
};

/**
 * Private capital gain. Skattesatsen beror på klassificeringen:
 *
 * - Privatbostad: 22 % effektiv skatt (schablonmässigt 22/30 av vinsten,
 *   VERIFIED).
 * - Näringsfastighet: 27 % effektiv skatt (IL 45:33 — 90 % av vinsten tas
 *   upp i kapital, dvs 0,9 x kapitalinkomstskatten, VERIFIED).
 * - Risk för handel med fastigheter: hamnar inte i kapitalvinst alls, utan
 *   i inkomstslaget näringsverksamhet — progressiv kommunal/statlig skatt
 *   plus egenavgifter. Det finns ingen fast sats, så den här grenen använder
 *   en tydligt flaggad uppskattning i stället för att låtsas veta exakt.
 */
export function calculatePrivateCapitalGain(params: {
  salePrice: number;
  saleCosts: number;
  purchasePrice: number;
  eligiblePurchaseCosts: number;
  eligibleImprovementCosts: number;
  classification: PrivatePropertyTaxClassification;
  privateResidentialEffectiveRate: number;
  businessPropertyEffectiveRate: number;
  propertyTradingRateAssumption: number;
}): CapitalGainResult {
  const taxBasis =
    params.purchasePrice + params.eligiblePurchaseCosts + params.eligibleImprovementCosts;
  const capitalGain = params.salePrice - params.saleCosts - taxBasis;

  const rate =
    params.classification === "private_residential_property"
      ? params.privateResidentialEffectiveRate
      : params.classification === "business_property"
        ? params.businessPropertyEffectiveRate
        : params.propertyTradingRateAssumption;

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
          params.classification === "property_trading_inventory_risk"
            ? "ESTIMATE"
            : params.classification === "private_residential_property"
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
          {
            label:
              params.classification === "property_trading_inventory_risk"
                ? "Skattesats (grov uppskattning — näringsverksamhet, inte kapitalvinst)"
                : "Skattesats",
            value: `${(rate * 100).toFixed(1).replace(".", ",")} %`,
          },
          { label: "Skatt", value: capitalGainTax },
        ],
      },
    ],
  };
}
