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

const PROPERTY_TYPES: { value: PropertyType; label: string }[] = [
  { value: "detached_house", label: "Detached house" },
  { value: "townhouse", label: "Townhouse" },
  { value: "holiday_home", label: "Holiday home" },
  { value: "apartment", label: "Apartment" },
  { value: "commercial", label: "Commercial" },
  { value: "other", label: "Other" },
];

const STATUSES: { value: ProjectStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "renovation", label: "Under renovation" },
  { value: "for_sale", label: "For sale" },
  { value: "sold", label: "Sold" },
  { value: "archived", label: "Archived" },
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
      <Collapsible title="Project" defaultOpen>
        <div className="space-y-3">
          <TextField
            label="Project name"
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
            label="Address"
            value={project.facts.address}
            onChange={(v) => update((d) => void (d.facts.address = v))}
          />
          <TextField
            label="Municipality"
            value={project.facts.municipality}
            onChange={(v) => update((d) => void (d.facts.municipality = v))}
          />
          <TextField
            label="Property designation"
            value={project.facts.propertyDesignation}
            onChange={(v) => update((d) => void (d.facts.propertyDesignation = v))}
          />
          <SelectField
            label="Property type"
            value={project.facts.propertyType}
            options={PROPERTY_TYPES}
            onChange={(v) => update((d) => void (d.facts.propertyType = v))}
          />
          <SelectField
            label="Tenure"
            value={project.facts.tenure ?? "freehold"}
            options={[
              { value: "freehold", label: "Freehold" },
              { value: "leasehold", label: "Leasehold" },
              { value: "condominium", label: "Condominium" },
              { value: "other", label: "Other" },
            ]}
            onChange={(v) => update((d) => void (d.facts.tenure = v))}
          />
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="Living area"
              suffix="m²"
              value={project.facts.livingAreaSqm ?? null}
              allowNull
              onChange={(v) => update((d) => void (d.facts.livingAreaSqm = v))}
            />
            <NumberField
              label="Plot area"
              suffix="m²"
              value={project.facts.plotAreaSqm ?? null}
              allowNull
              onChange={(v) => update((d) => void (d.facts.plotAreaSqm = v))}
            />
            <NumberField
              label="Ancillary area"
              suffix="m²"
              value={project.facts.ancillaryAreaSqm ?? null}
              allowNull
              onChange={(v) => update((d) => void (d.facts.ancillaryAreaSqm = v))}
            />
            <NumberField
              label="Construction year"
              value={project.facts.constructionYear ?? null}
              allowNull
              onChange={(v) => update((d) => void (d.facts.constructionYear = v))}
            />
          </div>
        </div>
      </Collapsible>

      <Collapsible title="Purchase" defaultOpen>
        <div className="space-y-3">
          <NumberField
            label="Purchase price"
            suffix="kr"
            source="USER_INPUT"
            allowNull
            value={project.inputs.purchasePrice}
            onChange={(v) => update((d) => void (d.inputs.purchasePrice = v))}
          />
          <NumberField
            label="Prior-year tax assessment value"
            suffix="kr"
            source="USER_INPUT"
            allowNull
            hint="Stamp duty base is the higher of purchase price and assessment value."
            value={project.inputs.priorYearTaxAssessmentValue}
            onChange={(v) => update((d) => void (d.inputs.priorYearTaxAssessmentValue = v))}
          />
          <NumberField
            label="Existing mortgage deeds"
            suffix="kr"
            source="USER_INPUT"
            allowNull
            value={project.inputs.existingMortgageDeeds}
            onChange={(v) => update((d) => void (d.inputs.existingMortgageDeeds = v))}
          />
          <NumberField
            label="Holding period"
            suffix="mo"
            source="USER_INPUT"
            value={project.inputs.holdingPeriodMonths}
            onChange={(v) => update((d) => void (d.inputs.holdingPeriodMonths = v ?? 0))}
          />
          <div className="grid grid-cols-2 gap-2">
            <PercentField
              label="Owner 1 share"
              value={project.inputs.ownershipSharePerson1}
              onChange={(v) => update((d) => void (d.inputs.ownershipSharePerson1 = v ?? 0))}
            />
            <PercentField
              label="Owner 2 share"
              value={project.inputs.ownershipSharePerson2}
              onChange={(v) => update((d) => void (d.inputs.ownershipSharePerson2 = v ?? 0))}
            />
          </div>
          {!ownershipValid && (
            <p className="text-[11px] text-negative">
              Ownership shares must total 100% (currently {(ownershipSum * 100).toFixed(1)}%).
            </p>
          )}
        </div>
      </Collapsible>

      <Collapsible title="Renovation">
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
            label="Contingency"
            source="ESTIMATE"
            value={project.renovation.contingencyPercent}
            onChange={(v) => update((d) => void (d.renovation.contingencyPercent = v ?? 0))}
          />
        </div>
      </Collapsible>

      <Collapsible title="Hidden / frequently missed costs">
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
                  label="Include"
                  value={item.included}
                  onChange={(v) => update((d) => void (d.hiddenCosts[index].included = v))}
                />
              </div>
            </div>
          ))}
        </div>
      </Collapsible>

      <Collapsible title="Operating costs">
        <div className="space-y-3">
          {RUNNING_COST_KEYS.map((key) => (
            <NumberField
              key={key}
              label={`${RUNNING_COST_LABELS[key]} (annual)`}
              suffix="kr"
              value={project.operatingCosts[key]}
              onChange={(v) => update((d) => void (d.operatingCosts[key] = v ?? 0))}
            />
          ))}
          <NumberField
            label="Property fee (annual) — blank = auto"
            suffix="kr"
            allowNull
            source="VERIFIED"
            hint="Auto = min(assessment value × 0.75%, annual cap)."
            value={project.operatingCosts.propertyFeeAnnual}
            onChange={(v) => update((d) => void (d.operatingCosts.propertyFeeAnnual = v))}
          />
        </div>
      </Collapsible>

      <Collapsible title="Rental">
        <div className="space-y-3">
          <ToggleField
            label="Rental enabled"
            value={project.rental.enabled}
            onChange={(v) => update((d) => void (d.rental.enabled = v))}
          />
          {project.rental.enabled && (
            <>
              <NumberField
                label="Rented weeks"
                value={project.rental.rentedWeeks}
                onChange={(v) => update((d) => void (d.rental.rentedWeeks = v ?? 0))}
              />
              <NumberField
                label="Rent per week"
                suffix="kr"
                value={project.rental.rentPerWeek}
                onChange={(v) => update((d) => void (d.rental.rentPerWeek = v ?? 0))}
              />
              <PercentField
                label="Platform fee"
                value={project.rental.platformFeePercent}
                onChange={(v) => update((d) => void (d.rental.platformFeePercent = v ?? 0))}
              />
              <NumberField
                label="Cleaning per stay"
                suffix="kr"
                value={project.rental.cleaningPerStay}
                onChange={(v) => update((d) => void (d.rental.cleaningPerStay = v ?? 0))}
              />
              <NumberField
                label="Number of stays"
                value={project.rental.numberOfStays}
                onChange={(v) => update((d) => void (d.rental.numberOfStays = v ?? 0))}
              />
              <NumberField
                label="Extra utilities"
                suffix="kr"
                value={project.rental.extraUtilities}
                onChange={(v) => update((d) => void (d.rental.extraUtilities = v ?? 0))}
              />
              <NumberField
                label="Extra wear and tear"
                suffix="kr"
                value={project.rental.extraWearAndTear}
                onChange={(v) => update((d) => void (d.rental.extraWearAndTear = v ?? 0))}
              />
            </>
          )}
        </div>
      </Collapsible>

      <Collapsible title="Sale">
        <div className="space-y-3">
          <NumberField
            label="Expected sale price"
            suffix="kr"
            source="USER_INPUT"
            allowNull
            value={project.inputs.expectedSalePrice}
            onChange={(v) => update((d) => void (d.inputs.expectedSalePrice = v))}
          />
          <PercentField
            label="Price negotiation buffer"
            source="ESTIMATE"
            hint={`Applied to the headline price: ${formatMoney(
              (project.inputs.expectedSalePrice ?? 0) *
                (1 - project.sale.priceNegotiationBufferRate),
            )}`}
            value={project.sale.priceNegotiationBufferRate}
            onChange={(v) => update((d) => void (d.sale.priceNegotiationBufferRate = v ?? 0))}
          />
          <NumberField
            label="Broker fee (fixed)"
            suffix="kr"
            value={project.sale.brokerFeeFixed}
            onChange={(v) => update((d) => void (d.sale.brokerFeeFixed = v ?? 0))}
          />
          <PercentField
            label="Broker fee (percent of price)"
            value={project.sale.brokerFeePercent}
            onChange={(v) => update((d) => void (d.sale.brokerFeePercent = v ?? 0))}
          />
          {(
            [
              ["photography", "Photography"],
              ["styling", "Styling"],
              ["inspection", "Inspection"],
              ["sellerInsurance", "Seller insurance"],
              ["cleaning", "Cleaning"],
              ["legal", "Legal"],
              ["other", "Other"],
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
