import type { VatInputs, VatResult } from "@/types";

export const RESIDENTIAL_VAT_WARNING =
  "Momsavdrag på bostad kräver särskilt stöd i skattereglerna. Stäm av med skatterådgivare.";

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

  return {
    grossAmount: renovationTotalGross,
    vatIncluded,
    deductibleVat,
    nonDeductibleVat,
    trueCashCost,
    warning,
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
        ],
      },
    ],
  };
}
