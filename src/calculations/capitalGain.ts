import type { CapitalGainResult, PrivatePropertyTaxClassification } from "@/types";

const CLASSIFICATION_LABELS: Record<PrivatePropertyTaxClassification, string> = {
  private_residential_property: "Privatbostad",
  business_property: "Näringsfastighet",
  property_trading_inventory_risk: "Risk för handel med fastigheter",
};

/**
 * Private capital gain, med skattelättnad vid förlust — inte bara noll.
 *
 * Skattesatsen på VINST beror på klassificeringen:
 * - Privatbostad: 22 % effektiv skatt (22/30 av vinsten, VERIFIED).
 * - Näringsfastighet: 27 % effektiv skatt (IL 45:33 — 90 % av vinsten tas
 *   upp i kapital, VERIFIED).
 * - Risk för handel med fastigheter: näringsverksamhet, inte kapitalvinst —
 *   ingen fast sats, en tydligt flaggad uppskattning används i stället.
 *
 * Vid FÖRLUST är avdragsrätten mindre än 100 %, men den är inte noll:
 * - Privatbostad: 50 % av förlusten är avdragsgill mot kapitalinkomst,
 *   dvs. en effektiv lättnad på 15 % av förlusten (50 % x 30 %, VERIFIED).
 * - Näringsfastighet: 63 % avdragsgill, effektiv lättnad 18,9 % (VERIFIED).
 * - Handel med fastigheter: förluster i näringsverksamhet är i regel fullt
 *   avdragsgilla mot annan näringsinkomst — samma osäkra sats som på
 *   vinstsidan används symmetriskt.
 *
 * Förenkling värd att känna till: lättnaden räknas fristående per försäljning
 * och tar inte hänsyn till att ett underskott av kapital totalt (den här
 * förlusten plus t.ex. låneränta) är skattereduktion i steg — 30 % upp till
 * 100 000 kr, 21 % däröver, per person. Är den samlade kapitalförlusten
 * stor kan den verkliga lättnaden alltså bli något lägre än vad som visas
 * här.
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
  privateResidentialLossReliefRate: number;
  businessPropertyLossReliefRate: number;
}): CapitalGainResult {
  const taxBasis =
    params.purchasePrice + params.eligiblePurchaseCosts + params.eligibleImprovementCosts;
  const capitalGain = params.salePrice - params.saleCosts - taxBasis;

  const gainRate =
    params.classification === "private_residential_property"
      ? params.privateResidentialEffectiveRate
      : params.classification === "business_property"
        ? params.businessPropertyEffectiveRate
        : params.propertyTradingRateAssumption;

  const lossReliefRate =
    params.classification === "private_residential_property"
      ? params.privateResidentialLossReliefRate
      : params.classification === "business_property"
        ? params.businessPropertyLossReliefRate
        : params.propertyTradingRateAssumption;

  const taxOnGain = Math.max(0, capitalGain) * gainRate;
  const reliefOnLoss = Math.max(0, -capitalGain) * lossReliefRate;
  // Negativ = nettolättnad snarare än skatt — flödar igenom som en högre
  // vinst efter skatt där det används, precis som avsett.
  const capitalGainTax = taxOnGain - reliefOnLoss;

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
          { label: "Kapitalvinst (negativ = förlust)", value: capitalGain },
          { label: "Klassificering", value: CLASSIFICATION_LABELS[params.classification] },
          {
            label:
              params.classification === "property_trading_inventory_risk"
                ? "Skattesats vid vinst (grov uppskattning — näringsverksamhet, inte kapitalvinst)"
                : "Skattesats vid vinst",
            value: `${(gainRate * 100).toFixed(1).replace(".", ",")} %`,
          },
          {
            label: "Effektiv lättnad vid förlust",
            value: `${(lossReliefRate * 100).toFixed(1).replace(".", ",")} %`,
          },
          { label: "Skatt (negativ = lättnad)", value: capitalGainTax },
        ],
      },
    ],
  };
}
