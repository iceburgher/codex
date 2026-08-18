"use client";

import { formatMoney } from "@/lib/format";
import type { PropertyProject } from "@/types";
import { Card, NumberField } from "../ui";

type Update = (updater: (draft: PropertyProject) => void) => void;

/**
 * De fyra uppgifter som avgör hela kalkylen. Allt annat är finjustering och
 * bor under fliken Antaganden.
 */
export function QuickFacts({
  project,
  update,
  onGoToRenovation,
}: {
  project: PropertyProject;
  update: Update;
  onGoToRenovation?: () => void;
}) {
  const itemised = itemisedRenovation(project);

  return (
    <Card title="Grunduppgifter" subtitle="Ändra här så räknas alla ägarformer om direkt.">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <NumberField
          label="Köpeskilling"
          suffix="kr"
          size="lg"
          allowNull
          value={project.inputs.purchasePrice}
          onChange={(v) => update((d) => void (d.inputs.purchasePrice = v))}
        />

        {/*
          Snabbfältet styr posten "Övrigt". Finns det redan poster ifyllda
          visas de separat under fältet, så att summan alltid går ihop med
          det som står under Antaganden.
        */}
        <div>
          <NumberField
            label="Renoveringsbudget"
            suffix="kr"
            size="lg"
            hint={
              itemised === 0
                ? "Fördela på poster under Antaganden när offerter finns."
                : undefined
            }
            value={project.renovation.other}
            onChange={(v) => update((d) => void (d.renovation.other = v ?? 0))}
          />
          {itemised > 0 && (
            <button
              type="button"
              onClick={onGoToRenovation}
              className="mt-1 text-left text-xs text-muted hover:text-accent"
            >
              + {formatMoney(itemised)} på enskilda poster ={" "}
              <span className="font-medium">{formatMoney(itemised + project.renovation.other)}</span>
            </button>
          )}
        </div>

        <NumberField
          label="Förväntat försäljningspris"
          suffix="kr"
          size="lg"
          allowNull
          value={project.inputs.expectedSalePrice}
          onChange={(v) => update((d) => void (d.inputs.expectedSalePrice = v))}
        />
        <NumberField
          label="Ägandetid"
          suffix="mån"
          size="lg"
          value={project.inputs.holdingPeriodMonths}
          onChange={(v) => update((d) => void (d.inputs.holdingPeriodMonths = v ?? 0))}
        />
      </div>

      <p className="mt-4 text-xs text-muted">
        Till renoveringen läggs {(project.renovation.contingencyPercent * 100).toFixed(0)} % för
        oförutsett. Ändra påslaget under Antaganden.
      </p>
    </Card>
  );
}

/** Summan av alla renoveringsposter utom "Övrigt", som snabbfältet styr. */
function itemisedRenovation(project: PropertyProject): number {
  const r = project.renovation;
  return (
    r.laborGross +
    r.materialsGross +
    r.architect +
    r.structuralEngineer +
    r.buildingPermit +
    r.controlManager +
    r.inspection +
    r.groundWorks +
    r.demolition +
    r.wasteAndContainers +
    r.transport +
    r.equipmentRental +
    r.projectManagement +
    r.appliances +
    r.fixedInterior +
    r.looseInterior +
    r.styling +
    r.landscaping
  );
}
