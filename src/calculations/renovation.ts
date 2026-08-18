import type { RenovationInputs, RenovationResult } from "@/types";

export const RENOVATION_LINE_KEYS = [
  "laborGross",
  "materialsGross",
  "architect",
  "structuralEngineer",
  "buildingPermit",
  "controlManager",
  "inspection",
  "groundWorks",
  "demolition",
  "wasteAndContainers",
  "transport",
  "equipmentRental",
  "projectManagement",
  "appliances",
  "fixedInterior",
  "looseInterior",
  "styling",
  "landscaping",
  "other",
] as const;

export type RenovationLineKey = (typeof RENOVATION_LINE_KEYS)[number];

export const RENOVATION_LINE_LABELS: Record<RenovationLineKey, string> = {
  laborGross: "Arbetskostnad (inkl. moms)",
  materialsGross: "Material (inkl. moms)",
  architect: "Arkitekt",
  structuralEngineer: "Konstruktör",
  buildingPermit: "Bygglov",
  controlManager: "Kontrollansvarig",
  inspection: "Besiktning",
  groundWorks: "Markarbete",
  demolition: "Rivning",
  wasteAndContainers: "Avfall och container",
  transport: "Transport",
  equipmentRental: "Maskinhyra",
  projectManagement: "Projektledning",
  appliances: "Vitvaror",
  fixedInterior: "Fast inredning",
  looseInterior: "Lös inredning",
  styling: "Styling",
  landscaping: "Trädgård",
  other: "Övrigt",
};

export function calculateRenovation(input: RenovationInputs): RenovationResult {
  const renovationSubtotal = RENOVATION_LINE_KEYS.reduce(
    (sum, key) => sum + (input[key] || 0),
    0,
  );
  const contingency = renovationSubtotal * (input.contingencyPercent || 0);
  const renovationTotalGross = renovationSubtotal + contingency;

  return {
    renovationSubtotal,
    contingency,
    renovationTotalGross,
    audit: [
      {
        title: "Renovering totalt",
        source: "USER_INPUT",
        lines: [
          { label: "Summa poster", value: renovationSubtotal },
          {
            label: `Oförutsett (${((input.contingencyPercent || 0) * 100).toFixed(1).replace(".", ",")} %)`,
            value: contingency,
          },
          { label: "Totalt inkl. moms", value: renovationTotalGross },
        ],
      },
    ],
  };
}
