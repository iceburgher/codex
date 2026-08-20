"use client";

import {
  RENOVATION_LINE_KEYS,
  RENOVATION_LINE_LABELS,
  type RenovationLineKey,
} from "@/calculations/renovation";
import { RUNNING_COST_KEYS, RUNNING_COST_LABELS } from "@/calculations/operatingCosts";
import { formatMoney } from "@/lib/format";
import type { PropertyProject, PropertyType, ProjectStatus } from "@/types";
import {
  Collapsible,
  NumberField,
  PercentField,
  SelectField,
  TextField,
  ToggleField,
} from "../ui";

type Update = (updater: (draft: PropertyProject) => void) => void;

export const PROPERTY_TYPES: { value: PropertyType; label: string }[] = [
  { value: "detached_house", label: "Villa" },
  { value: "townhouse", label: "Radhus" },
  { value: "holiday_home", label: "Fritidshus" },
  { value: "apartment", label: "Lägenhet" },
  { value: "commercial", label: "Lokal" },
  { value: "other", label: "Annat" },
];

const STATUSES: { value: ProjectStatus; label: string }[] = [
  { value: "draft", label: "Utkast" },
  { value: "active", label: "Aktivt" },
  { value: "renovation", label: "Under renovering" },
  { value: "for_sale", label: "Till salu" },
  { value: "sold", label: "Sålt" },
  { value: "archived", label: "Arkiverat" },
];

/** Object-level facts and economics — entered once, shared by every scenario. */
export function ObjectInputs({
  project,
  update,
}: {
  project: PropertyProject;
  update: Update;
}) {
  const ownershipSum =
    project.inputs.ownershipSharePerson1 + project.inputs.ownershipSharePerson2;
  const ownershipValid = Math.abs(ownershipSum - 1) < 0.0001;

  return (
    <div className="space-y-2">
      <Collapsible title="Projekt" defaultOpen>
        <div className="space-y-3">
          <TextField
            label="Projektnamn"
            value={project.name}
            onChange={(v) => update((d) => void (d.name = v))}
          />
          <SelectField
            label="Status"
            value={project.status}
            options={STATUSES}
            onChange={(v) => update((d) => void (d.status = v))}
          />
          <TextField
            label="Adress"
            value={project.facts.address}
            onChange={(v) => update((d) => void (d.facts.address = v))}
          />
          <TextField
            label="Kommun"
            value={project.facts.municipality}
            onChange={(v) => update((d) => void (d.facts.municipality = v))}
          />
          <TextField
            label="Fastighetsbeteckning"
            value={project.facts.propertyDesignation}
            onChange={(v) => update((d) => void (d.facts.propertyDesignation = v))}
          />
          <SelectField
            label="Typ av objekt"
            value={project.facts.propertyType}
            options={PROPERTY_TYPES}
            onChange={(v) => update((d) => void (d.facts.propertyType = v))}
          />
          <SelectField
            label="Upplåtelseform"
            value={project.facts.tenure ?? "freehold"}
            options={[
              { value: "freehold", label: "Äganderätt" },
              { value: "leasehold", label: "Tomträtt" },
              { value: "condominium", label: "Bostadsrätt" },
              { value: "other", label: "Annat" },
            ]}
            onChange={(v) => update((d) => void (d.facts.tenure = v))}
          />
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="Boarea"
              suffix="m²"
              value={project.facts.livingAreaSqm ?? null}
              allowNull
              onChange={(v) => update((d) => void (d.facts.livingAreaSqm = v))}
            />
            <NumberField
              label="Tomtarea"
              suffix="m²"
              value={project.facts.plotAreaSqm ?? null}
              allowNull
              onChange={(v) => update((d) => void (d.facts.plotAreaSqm = v))}
            />
            <NumberField
              label="Biarea"
              suffix="m²"
              value={project.facts.ancillaryAreaSqm ?? null}
              allowNull
              onChange={(v) => update((d) => void (d.facts.ancillaryAreaSqm = v))}
            />
            <NumberField
              label="Byggår"
              value={project.facts.constructionYear ?? null}
              allowNull
              onChange={(v) => update((d) => void (d.facts.constructionYear = v))}
            />
          </div>
        </div>
      </Collapsible>

      <Collapsible title="Köp" defaultOpen>
        <div className="space-y-3">
          <NumberField
            label="Köpeskilling"
            suffix="kr"
            source="USER_INPUT"
            allowNull
            value={project.inputs.purchasePrice}
            onChange={(v) => update((d) => void (d.inputs.purchasePrice = v))}
          />
          <NumberField
            label="Taxeringsvärde föregående år"
            suffix="kr"
            source="USER_INPUT"
            allowNull
            hint="Lagfartskostnaden räknas på det högsta av köpeskilling och taxeringsvärde."
            value={project.inputs.priorYearTaxAssessmentValue}
            onChange={(v) => update((d) => void (d.inputs.priorYearTaxAssessmentValue = v))}
          />
          <NumberField
            label="Befintliga pantbrev"
            suffix="kr"
            source="USER_INPUT"
            allowNull
            value={project.inputs.existingMortgageDeeds}
            onChange={(v) => update((d) => void (d.inputs.existingMortgageDeeds = v))}
          />
          <NumberField
            label="Ägandetid"
            suffix="mån"
            source="USER_INPUT"
            value={project.inputs.holdingPeriodMonths}
            onChange={(v) => update((d) => void (d.inputs.holdingPeriodMonths = v ?? 0))}
          />
          <div className="grid grid-cols-2 gap-2">
            <PercentField
              label="Ägare 1, andel"
              value={project.inputs.ownershipSharePerson1}
              onChange={(v) => update((d) => void (d.inputs.ownershipSharePerson1 = v ?? 0))}
            />
            <PercentField
              label="Ägare 2, andel"
              value={project.inputs.ownershipSharePerson2}
              onChange={(v) => update((d) => void (d.inputs.ownershipSharePerson2 = v ?? 0))}
            />
          </div>
          {!ownershipValid && (
            <p className="text-[11px] text-negative">
              Andelarna måste bli 100 % tillsammans (nu {(ownershipSum * 100).toFixed(1).replace(".", ",")} %).
            </p>
          )}
        </div>
      </Collapsible>

      <Collapsible title="Renovering">
        <div className="space-y-3">
          {RENOVATION_LINE_KEYS.map((key: RenovationLineKey) => (
            <NumberField
              key={key}
              label={RENOVATION_LINE_LABELS[key]}
              suffix="kr"
              value={project.renovation[key]}
              onChange={(v) => update((d) => void (d.renovation[key] = v ?? 0))}
            />
          ))}
          <PercentField
            label="Påslag för oförutsett"
            source="ESTIMATE"
            value={project.renovation.contingencyPercent}
            onChange={(v) => update((d) => void (d.renovation.contingencyPercent = v ?? 0))}
          />
        </div>
      </Collapsible>

      <Collapsible title="Kostnader som ofta glöms bort">
        <div className="space-y-2.5">
          {project.hiddenCosts.map((item, index) => (
            <div key={item.id} className="flex items-end gap-2">
              <div className="flex-1">
                <NumberField
                  label={item.label}
                  suffix="kr"
                  value={item.amount}
                  onChange={(v) =>
                    update((d) => void (d.hiddenCosts[index].amount = v ?? 0))
                  }
                />
              </div>
              <div className="pb-2">
                <ToggleField
                  label="Ta med"
                  value={item.included}
                  onChange={(v) => update((d) => void (d.hiddenCosts[index].included = v))}
                />
              </div>
            </div>
          ))}
        </div>
      </Collapsible>

      <Collapsible title="Driftkostnader">
        <div className="space-y-3">
          {RUNNING_COST_KEYS.map((key) => (
            <NumberField
              key={key}
              label={`${RUNNING_COST_LABELS[key]} per år`}
              suffix="kr"
              value={project.operatingCosts[key]}
              onChange={(v) => update((d) => void (d.operatingCosts[key] = v ?? 0))}
            />
          ))}
          <NumberField
            label="Fastighetsavgift per år — tom = beräknas"
            suffix="kr"
            allowNull
            source="VERIFIED"
            hint="Beräknas som taxeringsvärde × 0,75 %, dock högst takbeloppet. Hus med värdeår 2012 eller senare är befriade de första 15 åren (baserat på angivet byggår)."
            value={project.operatingCosts.propertyFeeAnnual}
            onChange={(v) => update((d) => void (d.operatingCosts.propertyFeeAnnual = v))}
          />
        </div>
      </Collapsible>

      <Collapsible title="Uthyrning">
        <div className="space-y-3">
          <ToggleField
            label="Huset ska hyras ut"
            value={project.rental.enabled}
            onChange={(v) => update((d) => void (d.rental.enabled = v))}
          />
          {project.rental.enabled && (
            <>
              <NumberField
                label="Antal uthyrda veckor"
                value={project.rental.rentedWeeks}
                onChange={(v) => update((d) => void (d.rental.rentedWeeks = v ?? 0))}
              />
              <NumberField
                label="Hyra per vecka"
                suffix="kr"
                value={project.rental.rentPerWeek}
                onChange={(v) => update((d) => void (d.rental.rentPerWeek = v ?? 0))}
              />
              <PercentField
                label="Avgift till förmedlare"
                value={project.rental.platformFeePercent}
                onChange={(v) => update((d) => void (d.rental.platformFeePercent = v ?? 0))}
              />
              <NumberField
                label="Städning per uthyrning"
                suffix="kr"
                value={project.rental.cleaningPerStay}
                onChange={(v) => update((d) => void (d.rental.cleaningPerStay = v ?? 0))}
              />
              <NumberField
                label="Antal uthyrningstillfällen"
                value={project.rental.numberOfStays}
                onChange={(v) => update((d) => void (d.rental.numberOfStays = v ?? 0))}
              />
              <NumberField
                label="Extra el, vatten m.m."
                suffix="kr"
                value={project.rental.extraUtilities}
                onChange={(v) => update((d) => void (d.rental.extraUtilities = v ?? 0))}
              />
              <NumberField
                label="Extra slitage"
                suffix="kr"
                value={project.rental.extraWearAndTear}
                onChange={(v) => update((d) => void (d.rental.extraWearAndTear = v ?? 0))}
              />
            </>
          )}
        </div>
      </Collapsible>

      <Collapsible title="Försäljning">
        <div className="space-y-3">
          <NumberField
            label="Förväntat försäljningspris"
            suffix="kr"
            source="USER_INPUT"
            allowNull
            value={project.inputs.expectedSalePrice}
            onChange={(v) => update((d) => void (d.inputs.expectedSalePrice = v))}
          />
          <PercentField
            label="Prutmån"
            source="ESTIMATE"
            hint={`Räknar med ett pris på ${formatMoney(
              (project.inputs.expectedSalePrice ?? 0) *
                (1 - project.sale.priceNegotiationBufferRate),
            )}`}
            value={project.sale.priceNegotiationBufferRate}
            onChange={(v) => update((d) => void (d.sale.priceNegotiationBufferRate = v ?? 0))}
          />
          <NumberField
            label="Mäklararvode, fast del"
            suffix="kr"
            value={project.sale.brokerFeeFixed}
            onChange={(v) => update((d) => void (d.sale.brokerFeeFixed = v ?? 0))}
          />
          <PercentField
            label="Mäklararvode, andel av priset"
            value={project.sale.brokerFeePercent}
            onChange={(v) => update((d) => void (d.sale.brokerFeePercent = v ?? 0))}
          />
          {(
            [
              ["photography", "Fotografering"],
              ["styling", "Styling"],
              ["inspection", "Besiktning"],
              ["sellerInsurance", "Säljarförsäkring"],
              ["cleaning", "Städning"],
              ["legal", "Juridik"],
              ["other", "Övrigt"],
            ] as const
          ).map(([key, label]) => (
            <NumberField
              key={key}
              label={label}
              suffix="kr"
              value={project.sale[key]}
              onChange={(v) => update((d) => void (d.sale[key] = v ?? 0))}
            />
          ))}
        </div>
      </Collapsible>
    </div>
  );
}
