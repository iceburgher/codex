import type { DividendInputs, DividendResult } from "@/types";

/**
 * Grosses up a target net private cash amount into the dividend required from
 * the company, splitting across the low-tax (3:12) allowance and any amount
 * above it. The rate above the allowance is never assumed — when the user has
 * not supplied one, the excess is reported untaxed and flagged by the caller.
 */
export function calculateDividendGrossUp(params: {
  targetNetPrivateCash: number;
  dividend: DividendInputs;
}): DividendResult {
  const { targetNetPrivateCash, dividend } = params;
  const withinRate = dividend.dividendTaxWithinAllowance || 0;
  const aboveRate = dividend.dividendTaxAboveAllowance;
  const allowance = Math.max(0, dividend.availableLowTaxAllowance || 0);

  if (targetNetPrivateCash <= 0) {
    return emptyDividendResult();
  }

  // Gross needed if the whole amount fits within the allowance.
  const grossIfAllWithin = targetNetPrivateCash / (1 - withinRate);

  let withinAllowanceGross: number;
  let aboveAllowanceGross: number;

  if (grossIfAllWithin <= allowance) {
    withinAllowanceGross = grossIfAllWithin;
    aboveAllowanceGross = 0;
  } else {
    withinAllowanceGross = allowance;
    const netFromAllowance = allowance * (1 - withinRate);
    const remainingNet = targetNetPrivateCash - netFromAllowance;
    // Without a confirmed rate above the allowance we cannot gross up; report
    // the shortfall at face value so the gap is visible rather than hidden.
    aboveAllowanceGross =
      aboveRate === null || aboveRate === undefined
        ? remainingNet
        : remainingNet / (1 - aboveRate);
  }

  const withinAllowanceTax = withinAllowanceGross * withinRate;
  const aboveAllowanceTax =
    aboveRate === null || aboveRate === undefined ? 0 : aboveAllowanceGross * aboveRate;

  const grossDividendRequired = withinAllowanceGross + aboveAllowanceGross;
  const dividendTax = withinAllowanceTax + aboveAllowanceTax;
  const netCashToOwner = grossDividendRequired - dividendTax;

  return {
    targetNet: targetNetPrivateCash,
    withinAllowanceGross,
    withinAllowanceTax,
    aboveAllowanceGross,
    aboveAllowanceTax,
    grossDividendRequired,
    dividendTax,
    netCashToOwner,
    allowanceConsumed: withinAllowanceGross,
    allowanceExceeded: aboveAllowanceGross > 0,
    audit: [
      {
        title: "Utdelning till ägarna",
        source: "TAX_ADVISOR_INPUT",
        lines: [
          { label: "Önskat belopp netto privat", value: targetNetPrivateCash },
          { label: "Gränsbelopp (lågbeskattat)", value: allowance },
          { label: `Inom gränsbelopp, ${(withinRate * 100).toFixed(1).replace(".", ",")} %`, value: withinAllowanceGross },
          { label: "Skatt inom gränsbelopp", value: withinAllowanceTax },
          {
            label:
              aboveRate === null || aboveRate === undefined
                ? "Över gränsbelopp (skattesats saknas)"
                : `Över gränsbelopp, ${(aboveRate * 100).toFixed(1).replace(".", ",")} %`,
            value: aboveAllowanceGross,
          },
          { label: "Skatt över gränsbelopp", value: aboveAllowanceTax },
          { label: "Utdelning som krävs", value: grossDividendRequired },
          { label: "Total utdelningsskatt", value: dividendTax },
          { label: "Netto till ägaren", value: netCashToOwner },
        ],
      },
    ],
  };
}

/**
 * Distributes an available company profit (rather than solving for a target
 * net) across the allowance, used by the second-tax-layer module.
 */
export function distributeDividend(params: {
  grossAvailable: number;
  dividend: DividendInputs;
}): DividendResult {
  const { grossAvailable, dividend } = params;
  const withinRate = dividend.dividendTaxWithinAllowance || 0;
  const aboveRate = dividend.dividendTaxAboveAllowance;
  const allowance = Math.max(0, dividend.availableLowTaxAllowance || 0);

  if (grossAvailable <= 0) return emptyDividendResult();

  const withinAllowanceGross = Math.min(grossAvailable, allowance);
  const aboveAllowanceGross = Math.max(0, grossAvailable - allowance);
  const withinAllowanceTax = withinAllowanceGross * withinRate;
  const aboveAllowanceTax =
    aboveRate === null || aboveRate === undefined ? 0 : aboveAllowanceGross * aboveRate;
  const dividendTax = withinAllowanceTax + aboveAllowanceTax;

  return {
    targetNet: grossAvailable - dividendTax,
    withinAllowanceGross,
    withinAllowanceTax,
    aboveAllowanceGross,
    aboveAllowanceTax,
    grossDividendRequired: grossAvailable,
    dividendTax,
    netCashToOwner: grossAvailable - dividendTax,
    allowanceConsumed: withinAllowanceGross,
    allowanceExceeded: aboveAllowanceGross > 0,
    audit: [
      {
        title: "Utdelning av bolagets vinst",
        source: "TAX_ADVISOR_INPUT",
        lines: [
          { label: "Tillgängligt att dela ut", value: grossAvailable },
          { label: "Inom gränsbelopp", value: withinAllowanceGross },
          { label: "Över gränsbelopp", value: aboveAllowanceGross },
          { label: "Utdelningsskatt", value: dividendTax },
          { label: "Netto till ägarna", value: grossAvailable - dividendTax },
        ],
      },
    ],
  };
}

function emptyDividendResult(): DividendResult {
  return {
    targetNet: 0,
    withinAllowanceGross: 0,
    withinAllowanceTax: 0,
    aboveAllowanceGross: 0,
    aboveAllowanceTax: 0,
    grossDividendRequired: 0,
    dividendTax: 0,
    netCashToOwner: 0,
    allowanceConsumed: 0,
    allowanceExceeded: false,
    audit: [],
  };
}
