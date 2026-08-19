import type { TaxConfig } from "@/types";

/**
 * Central, editable tax configuration. Versioned by tax year so historical
 * project snapshots (TaxConfigSnapshot) remain stable when defaults change.
 *
 * Values marked VERIFIED below come from the spec's section 52 list. Values
 * left as user/advisor input default to null-like placeholders (0) and must
 * be confirmed before being relied on — see the assumption labels in the UI.
 */
export const TAX_CONFIG_VERSION = "2026.1";

export const DEFAULT_TAX_CONFIG_2026: TaxConfig = {
  taxYear: 2026,
  corporateTaxRate: 0.206, // VERIFIED
  privateResidentialCapitalGainEffectiveRate: 0.22, // VERIFIED (only for private_residential_property classification)
  businessPropertyCapitalGainEffectiveRate: 0.27, // VERIFIED (IL 45:33 — 90% av vinsten tas upp i kapital: 0,9 x 30%)
  propertyTradingEffectiveRateAssumption: 0.5, // ESTIMATE — näringsverksamhet: progressiv skatt + egenavgifter, ingen fast sats. Stäm av med rådgivare.
  privateResidentialLossReliefRate: 0.15, // VERIFIED (50% av förlusten avdragsgill x 30% kapitalskatt)
  businessPropertyLossReliefRate: 0.189, // VERIFIED (63% av förlusten avdragsgill x 30% kapitalskatt)
  capitalIncomeTaxRate: 0.3, // VERIFIED (Swedish capital income tax, used for private rental surplus)
  dividendTaxWithinAllowance: 0.2, // USER INPUT / commonly 20% within 3:12 allowance — verify per owner
  dividendTaxAboveAllowanceDefault: null, // must be supplied by user/advisor
  employerContributionRate: 0.3142, // USER INPUT — statutory default, editable
  privateStampDutyRate: 0.015, // VERIFIED
  companyStampDutyRate: 0.0425, // VERIFIED
  titleRegistrationFee: 825, // VERIFIED
  mortgageDeedTaxRate: 0.02, // VERIFIED
  mortgageDeedAdminFee: 0, // USER INPUT — set to actual value once known
  rotRate: 0.3, // VERIFIED
  rotMaxPerPerson: 50000, // VERIFIED
  rentalStandardDeduction: 40000, // VERIFIED
  rentalPercentDeduction: 0.2, // VERIFIED
  propertyFeeRate: 0.0075, // VERIFIED
  propertyFeeAnnualCap: 10425, // VERIFIED
  unsecuredLoanInterestDeductionRate: 0, // VERIFIED (from income year 2026)
  securedLoanInterestDeductionRateDefault: 0.3, // USER INPUT — standard mortgage interest deduction assumption, verify
};

export function mergeTaxConfig(
  overrides: Partial<TaxConfig> | null | undefined,
): TaxConfig {
  if (!overrides) return { ...DEFAULT_TAX_CONFIG_2026 };
  return { ...DEFAULT_TAX_CONFIG_2026, ...overrides };
}
