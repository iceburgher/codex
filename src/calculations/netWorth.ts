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
        title: "Family net worth delta",
        source: "ESTIMATE",
        lines: [
          { label: "Private cash after project", value: params.privateCashAfterProject },
          { label: "Company value after project", value: params.companyValueAfterProject },
          { label: "Remaining private debt", value: -params.remainingPrivateDebt },
          { label: "Remaining company debt (project)", value: -params.remainingCompanyDebt },
          { label: "Mode A — retained company wealth", value: modeA },
          { label: "Deferred owner tax to extract", value: -params.deferredOwnerTaxToExtract },
          { label: "Mode B — fully extracted", value: modeB },
          { label: "Capital consumed (baseline)", value: baselineFamilyNetWorth },
          { label: "Delta (Mode A)", value: modeA - baselineFamilyNetWorth },
          { label: "Delta (Mode B)", value: modeB - baselineFamilyNetWorth },
        ],
      },
    ],
  };
}
