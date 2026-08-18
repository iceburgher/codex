import type { BreakEvenResult } from "@/types";

export interface SolverOptions {
  tolerance?: number;
  maxIterations?: number;
  lowerBound?: number;
  upperBound?: number;
}

/**
 * Monotonic root finder over sale price. Taxes depend on sale price, so the
 * relationship is piecewise linear rather than linear — bisection is used
 * rather than a closed-form inversion.
 */
export function solveSalePrice(
  metricAtSalePrice: (salePrice: number) => number,
  target: number,
  options: SolverOptions = {},
): { salePrice: number | null; iterations: number; converged: boolean } {
  const tolerance = options.tolerance ?? 100;
  const maxIterations = options.maxIterations ?? 100;
  let lo = options.lowerBound ?? 0;
  let hi = options.upperBound ?? 100_000_000;

  let fLo = metricAtSalePrice(lo) - target;
  let fHi = metricAtSalePrice(hi) - target;

  if (!Number.isFinite(fLo) || !Number.isFinite(fHi)) {
    return { salePrice: null, iterations: 0, converged: false };
  }
  if (fLo > 0 && fHi > 0) return { salePrice: lo, iterations: 0, converged: false };
  if (fLo < 0 && fHi < 0) return { salePrice: null, iterations: 0, converged: false };

  let iterations = 0;
  let mid = lo;
  while (iterations < maxIterations && hi - lo > tolerance) {
    mid = (lo + hi) / 2;
    const fMid = metricAtSalePrice(mid) - target;
    if (fMid === 0) {
      lo = mid;
      hi = mid;
      iterations++;
      break;
    }
    if ((fLo < 0 && fMid < 0) || (fLo > 0 && fMid > 0)) {
      lo = mid;
      fLo = fMid;
    } else {
      hi = mid;
      fHi = fMid;
    }
    iterations++;
  }

  return { salePrice: (lo + hi) / 2, iterations, converged: hi - lo <= tolerance };
}

export function calculateBreakEven(params: {
  netProfitAtSalePrice: (salePrice: number) => number;
  equityRoiAtSalePrice: (salePrice: number) => number;
  upperBound?: number;
}): BreakEvenResult {
  const opts: SolverOptions = { upperBound: params.upperBound ?? 100_000_000 };

  const zero = solveSalePrice(params.netProfitAtSalePrice, 0, opts);
  const r10 = solveSalePrice(params.equityRoiAtSalePrice, 0.1, opts);
  const r20 = solveSalePrice(params.equityRoiAtSalePrice, 0.2, opts);
  const r30 = solveSalePrice(params.equityRoiAtSalePrice, 0.3, opts);

  return {
    breakEvenSalePrice: zero.salePrice,
    salePriceFor10PctROI: r10.salePrice,
    salePriceFor20PctROI: r20.salePrice,
    salePriceFor30PctROI: r30.salePrice,
    iterations: zero.iterations,
    converged: zero.converged,
  };
}
