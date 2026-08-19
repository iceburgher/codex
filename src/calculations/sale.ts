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
        title: "Försäljningskostnader",
        source: "ESTIMATE",
        lines: [
          { label: "Försäljningspris", value: expectedSalePrice },
          { label: "Mäklararvode", value: brokerFee },
          {
            label: "Moms på mäklararvode",
            value: "Ingår i beloppet — inte avdragsgill, eftersom försäljning av fastighet är momsfri",
          },
          { label: "Fotografering", value: sale.photography || 0 },
          { label: "Styling", value: sale.styling || 0 },
          { label: "Besiktning", value: sale.inspection || 0 },
          { label: "Säljarförsäkring", value: sale.sellerInsurance || 0 },
          { label: "Städning", value: sale.cleaning || 0 },
          { label: "Juridik", value: sale.legal || 0 },
          { label: "Övrigt", value: sale.other || 0 },
          { label: "Totalt", value: saleCostsTotal },
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
