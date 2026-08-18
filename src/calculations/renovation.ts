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
  laborGross: "Labor (gross)",
  materialsGross: "Materials (gross)",
  architect: "Architect",
  structuralEngineer: "Structural engineer",
  buildingPermit: "Building permit",
  controlManager: "Control manager (kontrollansvarig)",
  inspection: "Inspection",
  groundWorks: "Ground works",
  demolition: "Demolition",
  wasteAndContainers: "Waste & containers",
  transport: "Transport",
  equipmentRental: "Equipment rental",
  projectManagement: "Project management",
  appliances: "Appliances",
  fixedInterior: "Fixed interior",
  looseInterior: "Loose interior",
  styling: "Styling",
  landscaping: "Landscaping",
  other: "Other",
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
        title: "Renovation total",
        source: "USER_INPUT",
        lines: [
          { label: "Line items subtotal", value: renovationSubtotal },
          {
            label: `Contingency (${((input.contingencyPercent || 0) * 100).toFixed(1)}%)`,
            value: contingency,
          },
          { label: "Total gross", value: renovationTotalGross },
        ],
      },
    ],
  };
}
