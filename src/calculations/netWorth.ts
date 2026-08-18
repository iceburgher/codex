import type { FamilyNetWorthResult } from "@/types";

/**
 * Family net worth delta — the headline decision metric.
 *
 * Mode A values wealth left inside the company at its post-corporate-tax
 * amount (no owner-level extraction assumed).
 * Mode B assumes full extraction to the owners and therefore charges the
 * deferred owner tax needed to get the money out.
 *
 * The baseline is the private + company capital consumed to run the project,
 * so a scenario cannot look better merely because value is trapped in a company.
 */
export function calculateFamilyNetWorth(params: {
  privateCashAfterProject: number;
  companyValueAfterProject: number;
  deferredOwnerTaxToExtract: number;
  privateCapitalConsumed: number;
  companyCapitalConsumed: number;
  remainingPrivateDebt: number;
  remainingCompanyDebt: number;
}): FamilyNetWorthResult {
  const baselineFamilyNetWorth = params.privateCapitalConsumed + params.companyCapitalConsumed;

  const modeA =
    params.privateCashAfterProject +
    params.companyValueAfterProject -
    params.remainingPrivateDebt -
    params.remainingCompanyDebt;

  const modeB = modeA - params.deferredOwnerTaxToExtract;

  return {
    modeA_retainedCompanyWealth: modeA,
    modeB_fullyExtractedPrivateWealth: modeB,
    baselineFamilyNetWorth,
    familyNetWorthDeltaModeA: modeA - baselineFamilyNetWorth,
    familyNetWorthDeltaModeB: modeB - baselineFamilyNetWorth,
    audit: [
      {
        title: "Förändring av familjens förmögenhet",
        source: "ESTIMATE",
        lines: [
          { label: "Privata pengar efter projektet", value: params.privateCashAfterProject },
          { label: "Värde i bolaget efter projektet", value: params.companyValueAfterProject },
          { label: "Kvarvarande privat skuld", value: -params.remainingPrivateDebt },
          { label: "Kvarvarande skuld i bolaget", value: -params.remainingCompanyDebt },
          { label: "Läge A — pengarna kvar i bolaget", value: modeA },
          { label: "Skatt för att ta ut pengarna", value: -params.deferredOwnerTaxToExtract },
          { label: "Läge B — allt uttaget privat", value: modeB },
          { label: "Kapital som satsats", value: baselineFamilyNetWorth },
          { label: "Förändring, läge A", value: modeA - baselineFamilyNetWorth },
          { label: "Förändring, läge B", value: modeB - baselineFamilyNetWorth },
        ],
      },
    ],
  };
}
