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
        title: "Dividend extraction",
        source: "TAX_ADVISOR_INPUT",
        lines: [
          { label: "Target net private cash", value: targetNetPrivateCash },
          { label: "Low-tax allowance available", value: allowance },
          { label: `Within allowance @ ${(withinRate * 100).toFixed(1)}%`, value: withinAllowanceGross },
          { label: "Tax within allowance", value: withinAllowanceTax },
          {
            label:
              aboveRate === null || aboveRate === undefined
                ? "Above allowance (rate not supplied)"
                : `Above allowance @ ${(aboveRate * 100).toFixed(1)}%`,
            value: aboveAllowanceGross,
          },
          { label: "Tax above allowance", value: aboveAllowanceTax },
          { label: "Gross dividend required", value: grossDividendRequired },
          { label: "Total dividend tax", value: dividendTax },
          { label: "Net cash to owner", value: netCashToOwner },
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
        title: "Dividend distribution of company profit",
        source: "TAX_ADVISOR_INPUT",
        lines: [
          { label: "Gross available for distribution", value: grossAvailable },
          { label: "Within allowance", value: withinAllowanceGross },
          { label: "Above allowance", value: aboveAllowanceGross },
          { label: "Dividend tax", value: dividendTax },
          { label: "Net to owners", value: grossAvailable - dividendTax },
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
