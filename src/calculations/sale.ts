import type { SaleCostResult, SaleInputs } from "@/types";

export function calculateSaleCosts(params: {
  sale: SaleInputs;
  expectedSalePrice: number;
}): SaleCostResult {
  const { sale, expectedSalePrice } = params;
  const brokerFee = (sale.brokerFeeFixed || 0) + expectedSalePrice * (sale.brokerFeePercent || 0);
  const saleCostsTotal =
    brokerFee +
    (sale.photography || 0) +
    (sale.styling || 0) +
    (sale.inspection || 0) +
    (sale.sellerInsurance || 0) +
    (sale.cleaning || 0) +
    (sale.legal || 0) +
    (sale.other || 0);

  return {
    brokerFee,
    saleCostsTotal,
    audit: [
      {
        title: "Sale costs",
        source: "ESTIMATE",
        lines: [
          { label: "Sale price", value: expectedSalePrice },
          { label: "Broker fee", value: brokerFee },
          { label: "Photography", value: sale.photography || 0 },
          { label: "Styling", value: sale.styling || 0 },
          { label: "Inspection", value: sale.inspection || 0 },
          { label: "Seller insurance", value: sale.sellerInsurance || 0 },
          { label: "Cleaning", value: sale.cleaning || 0 },
          { label: "Legal", value: sale.legal || 0 },
          { label: "Other", value: sale.other || 0 },
          { label: "Total", value: saleCostsTotal },
        ],
      },
    ],
  };
}

/** Applies the price negotiation buffer to a headline expected sale price. */
export function applyNegotiationBuffer(
  expectedSalePrice: number,
  bufferRate: number,
): number {
  return expectedSalePrice * (1 - (bufferRate || 0));
}
