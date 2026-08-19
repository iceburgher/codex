import type { VatInputs, VatResult } from "@/types";

export const RESIDENTIAL_VAT_WARNING =
  "Momsavdrag på bostad kräver särskilt stöd i skattereglerna. Stäm av med skatterådgivare.";

/** Korrigeringstiden för jämkning av moms på fastighetsinvesteringar (10 år). */
export const VAT_ADJUSTMENT_PERIOD_MONTHS = 120;

/** VAT embedded in a gross (VAT-inclusive) amount. */
export function extractVat(grossAmount: number, vatRate: number): number {
  if (vatRate <= -1) return 0;
  return grossAmount - grossAmount / (1 + vatRate);
}

export function calculateVatLine(
  grossAmount: number,
  vatRate: number,
  deductiblePercent: number,
): { vatIncluded: number; deductibleVat: number; trueCashCost: number } {
  const vatIncluded = extractVat(grossAmount, vatRate);
  const deductibleVat = vatIncluded * deductiblePercent;
  const trueCashCost = grossAmount - deductibleVat;
  return { vatIncluded, deductibleVat, trueCashCost };
}

/**
 * VAT treatment across the renovation. Line-level overrides take precedence;
 * any remaining gross amount uses the scenario-level default rate/percent.
 */
export function calculateVat(params: {
  renovationTotalGross: number;
  vat: VatInputs;
  defaultVatRate: number;
  isCompanyOwned: boolean;
  /** Innehavstid i månader — avgör hur mycket av 10-årsperioden som är kvar vid försäljning. */
  holdingPeriodMonths: number;
}): VatResult {
  const { renovationTotalGross, vat, defaultVatRate } = params;

  const overriddenGross = vat.lines.reduce((sum, l) => sum + (l.grossAmount || 0), 0);
  const remainingGross = Math.max(0, renovationTotalGross - overriddenGross);

  let vatIncluded = 0;
  let deductibleVat = 0;

  for (const line of vat.lines) {
    const r = calculateVatLine(line.grossAmount, line.vatRate, line.deductiblePercent);
    vatIncluded += r.vatIncluded;
    deductibleVat += r.deductibleVat;
  }

  const effectiveDeductiblePercent =
    vat.vatTreatment === "none" ? 0 : vat.vatTreatment === "full" ? 1 : vat.vatDeductiblePercent;

  const rest = calculateVatLine(remainingGross, defaultVatRate, effectiveDeductiblePercent);
  vatIncluded += rest.vatIncluded;
  deductibleVat += rest.deductibleVat;

  const nonDeductibleVat = vatIncluded - deductibleVat;
  const trueCashCost = renovationTotalGross - deductibleVat;

  const warning =
    deductibleVat > 0 && params.isCompanyOwned ? RESIDENTIAL_VAT_WARNING : undefined;

  // Jämkning: dras moms av på en fastighetsinvestering och användningen ändras
  // inom tioårsperioden — vanligast genom att fastigheten säljs — kan en andel
  // av den avdragna momsen, motsvarande återstående tid, behöva betalas
  // tillbaka. Det här är en potentiell risk, inte en säker kostnad (den beror
  // på köparens fortsatta användning), så den dras aldrig av från vinsten här.
  const monthsRemainingInAdjustmentPeriod = Math.max(
    0,
    VAT_ADJUSTMENT_PERIOD_MONTHS - params.holdingPeriodMonths,
  );
  const potentialAdjustmentRepayment =
    deductibleVat * (monthsRemainingInAdjustmentPeriod / VAT_ADJUSTMENT_PERIOD_MONTHS);

  const adjustmentAuditLines =
    deductibleVat > 0 && monthsRemainingInAdjustmentPeriod > 0
      ? [
          { label: "Kvar av tioårig jämkningstid", value: monthsRemainingInAdjustmentPeriod },
          { label: "Möjlig återbetalning vid jämkning", value: potentialAdjustmentRepayment },
        ]
      : [];

  return {
    grossAmount: renovationTotalGross,
    vatIncluded,
    deductibleVat,
    nonDeductibleVat,
    trueCashCost,
    warning,
    adjustmentPeriodMonths: VAT_ADJUSTMENT_PERIOD_MONTHS,
    monthsRemainingInAdjustmentPeriod,
    potentialAdjustmentRepayment,
    audit: [
      {
        title: "Moms på renovering",
        source: "TAX_ADVISOR_INPUT",
        lines: [
          { label: "Renovering inkl. moms", value: renovationTotalGross },
          { label: "Varav moms", value: vatIncluded },
          { label: "Avdragsgill moms", value: deductibleVat },
          { label: "Ej avdragsgill moms", value: nonDeductibleVat },
          { label: "Verklig kostnad", value: trueCashCost },
          ...adjustmentAuditLines,
        ],
      },
    ],
  };
}
