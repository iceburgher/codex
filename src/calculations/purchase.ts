import type { AuditTrail, PurchaseCostResult } from "@/types";

export function calculateStampDutyBase(
  purchasePrice: number,
  priorYearTaxAssessmentValue: number,
): number {
  return Math.max(purchasePrice, priorYearTaxAssessmentValue || 0);
}

export function calculatePrivateStampDuty(
  purchasePrice: number,
  taxAssessmentValue: number,
  rate: number,
): number {
  const base = calculateStampDutyBase(purchasePrice, taxAssessmentValue);
  return base * rate;
}

/** Stamp duty plus the fixed title registration fee (lagfartskostnad). */
export function calculateTitleCost(
  purchasePrice: number,
  taxAssessmentValue: number,
  rate: number,
  registrationFee: number,
): number {
  return calculatePrivateStampDuty(purchasePrice, taxAssessmentValue, rate) + registrationFee;
}

export function calculateCompanyStampDuty(
  purchasePrice: number,
  taxAssessmentValue: number,
  rate: number,
): number {
  const base = calculateStampDutyBase(purchasePrice, taxAssessmentValue);
  return base * rate;
}

export function calculateNewMortgageDeedCost(
  securedDebt: number,
  existingMortgageDeeds: number,
  mortgageDeedTaxRate: number,
  mortgageDeedAdminFee: number,
): { requiredMortgageDeeds: number; newMortgageDeedTax: number; newMortgageDeedCost: number } {
  const requiredMortgageDeeds = Math.max(0, securedDebt - (existingMortgageDeeds || 0));
  const newMortgageDeedTax = requiredMortgageDeeds * mortgageDeedTaxRate;
  const newMortgageDeedCost = newMortgageDeedTax + mortgageDeedAdminFee;
  return { requiredMortgageDeeds, newMortgageDeedTax, newMortgageDeedCost };
}

export function calculatePurchaseCosts(params: {
  purchasePrice: number;
  priorYearTaxAssessmentValue: number;
  existingMortgageDeeds: number;
  securedDebt: number;
  isCompanyOwned: boolean;
  privateStampDutyRate: number;
  companyStampDutyRate: number;
  titleRegistrationFee: number;
  mortgageDeedTaxRate: number;
  mortgageDeedAdminFee: number;
}): PurchaseCostResult {
  const stampDutyBase = calculateStampDutyBase(
    params.purchasePrice,
    params.priorYearTaxAssessmentValue,
  );
  const rate = params.isCompanyOwned ? params.companyStampDutyRate : params.privateStampDutyRate;
  const stampDuty = stampDutyBase * rate;
  const titleCost = stampDuty + params.titleRegistrationFee;

  const { requiredMortgageDeeds, newMortgageDeedTax, newMortgageDeedCost } =
    calculateNewMortgageDeedCost(
      params.securedDebt,
      params.existingMortgageDeeds,
      params.mortgageDeedTaxRate,
      params.mortgageDeedAdminFee,
    );

  const totalPurchaseCosts = titleCost + newMortgageDeedCost;

  const audit: AuditTrail[] = [
    {
      title: params.isCompanyOwned ? "Lagfart (bolag)" : "Lagfart (privat)",
      source: "VERIFIED",
      lines: [
        { label: "Underlag", value: stampDutyBase },
        { label: "Skattesats", value: `${(rate * 100).toFixed(2).replace(".", ",")} %` },
        { label: "Stämpelskatt", value: stampDuty },
        { label: "Expeditionsavgift", value: params.titleRegistrationFee },
        { label: "Totalt", value: titleCost },
      ],
    },
    {
      title: "Nya pantbrev",
      source: "VERIFIED",
      lines: [
        { label: "Säkerställd skuld", value: params.securedDebt },
        { label: "Befintliga pantbrev", value: params.existingMortgageDeeds },
        { label: "Nya pantbrev som behövs", value: requiredMortgageDeeds },
        { label: "Stämpelskatt", value: newMortgageDeedTax },
        { label: "Expeditionsavgift", value: params.mortgageDeedAdminFee },
        { label: "Totalt", value: newMortgageDeedCost },
      ],
    },
  ];

  return {
    stampDutyBase,
    stampDuty,
    titleRegistrationFee: params.titleRegistrationFee,
    titleCost,
    requiredMortgageDeeds,
    newMortgageDeedTax,
    newMortgageDeedCost,
    totalPurchaseCosts,
    audit,
  };
}
