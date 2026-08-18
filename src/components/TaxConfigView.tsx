"use client";

import { useState } from "react";
import { DEFAULT_TAX_CONFIG_2026, TAX_CONFIG_VERSION, mergeTaxConfig } from "@/config/taxConfig";
import { useProjectStore } from "@/lib/store";
import type { AssumptionSource, PropertyProject, TaxConfig } from "@/types";
import { Button, Card, NumberField, PercentField, SelectField, SourceTag } from "./ui";

type Field = {
  key: keyof TaxConfig;
  label: string;
  kind: "percent" | "money";
  source: AssumptionSource;
  hint?: string;
};

const FIELDS: Field[] = [
  { key: "corporateTaxRate", label: "Bolagsskatt", kind: "percent", source: "VERIFIED" },
  {
    key: "privateResidentialCapitalGainEffectiveRate",
    label: "Kapitalvinstskatt privatbostad",
    kind: "percent",
    source: "VERIFIED",
    hint: "Används bara när fastigheten uttryckligen klassats som privatbostad.",
  },
  { key: "capitalIncomeTaxRate", label: "Kapitalskatt", kind: "percent", source: "VERIFIED" },
  {
    key: "dividendTaxWithinAllowance",
    label: "Utdelningsskatt inom gränsbelopp",
    kind: "percent",
    source: "TAX_ADVISOR_INPUT",
    hint: "3:12 beror på era förhållanden — själva gränsbeloppet fylls i per ägarform.",
  },
  {
    key: "employerContributionRate",
    label: "Arbetsgivaravgifter",
    kind: "percent",
    source: "USER_INPUT",
  },
  {
    key: "privateStampDutyRate",
    label: "Stämpelskatt, privatperson",
    kind: "percent",
    source: "VERIFIED",
  },
  {
    key: "companyStampDutyRate",
    label: "Stämpelskatt, juridisk person",
    kind: "percent",
    source: "VERIFIED",
  },
  {
    key: "titleRegistrationFee",
    label: "Expeditionsavgift lagfart",
    kind: "money",
    source: "VERIFIED",
  },
  {
    key: "mortgageDeedTaxRate",
    label: "Stämpelskatt nya pantbrev",
    kind: "percent",
    source: "VERIFIED",
  },
  {
    key: "mortgageDeedAdminFee",
    label: "Expeditionsavgift pantbrev",
    kind: "money",
    source: "USER_INPUT",
    hint: "Fyll i det verkliga beloppet när det är känt.",
  },
  { key: "rotRate", label: "ROT-avdrag, andel", kind: "percent", source: "VERIFIED" },
  { key: "rotMaxPerPerson", label: "ROT, tak per person och år", kind: "money", source: "VERIFIED" },
  {
    key: "rentalStandardDeduction",
    label: "Schablonavdrag uthyrning",
    kind: "money",
    source: "VERIFIED",
  },
  {
    key: "rentalPercentDeduction",
    label: "Procentavdrag uthyrning",
    kind: "percent",
    source: "VERIFIED",
  },
  { key: "propertyFeeRate", label: "Kommunal fastighetsavgift", kind: "percent", source: "VERIFIED" },
  { key: "propertyFeeAnnualCap", label: "Takbelopp fastighetsavgift", kind: "money", source: "VERIFIED" },
  {
    key: "unsecuredLoanInterestDeductionRate",
    label: "Ränteavdrag privatlån utan säkerhet",
    kind: "percent",
    source: "VERIFIED",
  },
  {
    key: "securedLoanInterestDeductionRateDefault",
    label: "Ränteavdrag bolån (standard)",
    kind: "percent",
    source: "TAX_ADVISOR_INPUT",
  },
];

/**
 * Global tax defaults plus per-project overrides. Changing a global default
 * never rewrites a project that has locked a snapshot.
 */
export function TaxConfigView() {
  const store = useProjectStore();
  const [selectedId, setSelectedId] = useState<string>("");

  const project = store.projects.find((p) => p.id === selectedId);
  const effective = project
    ? mergeTaxConfig(project.taxConfigSnapshot?.values ?? project.taxOverrides)
    : DEFAULT_TAX_CONFIG_2026;

  function updateOverride(key: keyof TaxConfig, value: number | null) {
    if (!project) return;
    const draft: PropertyProject = JSON.parse(JSON.stringify(project));
    if (value === null) delete draft.taxOverrides[key];
    else (draft.taxOverrides as Record<string, number>)[key as string] = value;
    store.updateProject(draft);
  }

  function toggleSnapshot() {
    if (!project) return;
    const draft: PropertyProject = JSON.parse(JSON.stringify(project));
    draft.taxConfigSnapshot = draft.taxConfigSnapshot
      ? null
      : {
          taxYear: effective.taxYear,
          sourceVersion: TAX_CONFIG_VERSION,
          lockedAt: new Date().toISOString(),
          values: mergeTaxConfig(draft.taxOverrides),
        };
    store.updateProject(draft);
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Skatteuppgifter</h1>
      <p className="mt-0.5 mb-4 text-xs text-muted">
        Gemensamma skattesatser (version {TAX_CONFIG_VERSION}, skatteår{" "}
        {DEFAULT_TAX_CONFIG_2026.taxYear}). Värdena går att ändra. Ändringar per projekt sparas
        separat och skrivs aldrig över av en ändring här.
      </p>

      <Card className="mb-4">
        <SelectField
          label="Ändra för ett visst projekt"
          value={selectedId}
          options={[
            { value: "", label: "Gemensamma värden (visas bara)" },
            ...store.projects.map((p) => ({ value: p.id, label: p.name })),
          ]}
          onChange={setSelectedId}
        />
        {project && (
          <div className="mt-3 flex items-center gap-2">
            <Button onClick={toggleSnapshot}>
              {project.taxConfigSnapshot ? "Lås upp skatteår" : "Lås skatteår"}
            </Button>
            <span className="text-[11px] text-muted">
              {project.taxConfigSnapshot
                ? `Låst ${project.taxConfigSnapshot.lockedAt?.slice(0, 10)} i version ${project.taxConfigSnapshot.sourceVersion} — ändringar av de gemensamma värdena påverkar inte projektet.`
                : "Inte låst — projektet följer de gemensamma värdena plus sina egna ändringar."}
            </span>
          </div>
        )}
      </Card>

      <Card
        title={project ? `Värden som används i ${project.name}` : "Gemensamma värden"}
        subtitle={
          project
            ? "Ändrar du ett värde här gäller det bara det här projektet."
            : "Välj ett projekt ovan för att ändra något av värdena."
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {FIELDS.map((field) => {
            const value = effective[field.key] as number;
            const overridden =
              project !== undefined && Object.hasOwn(project.taxOverrides, field.key);

            const onChange = (v: number | null) => updateOverride(field.key, v);

            return (
              <div
                key={String(field.key)}
                className={overridden ? "rounded-md bg-accent-soft p-2" : ""}
              >
                {field.kind === "percent" ? (
                  <PercentField
                    label={field.label}
                    value={value}
                    onChange={onChange}
                    source={field.source}
                    hint={field.hint}
                  />
                ) : (
                  <NumberField
                    label={field.label}
                    suffix="kr"
                    value={value}
                    onChange={onChange}
                    source={field.source}
                    hint={field.hint}
                  />
                )}
                {overridden && (
                  <button
                    type="button"
                    className="mt-1 text-[11px] text-accent underline"
                    onClick={() => updateOverride(field.key, null)}
                  >
                    Återställ
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {!project && (
          <p className="mt-4 text-[11px] text-muted">
            Utan valt projekt går värdena inte att ändra här — de gemensamma värdena följer med
            appen och är versionerade per skatteår.
          </p>
        )}
      </Card>

      <Card className="mt-4" title="Uppgifter ni själva måste fylla i eller få bekräftade">
        <ul className="grid gap-2.5 text-sm sm:grid-cols-2">
          {[
            "Vilken arbetsgivaravgift som gäller",
            "Er faktiska marginalskatt på lön",
            "Verkligt gränsbelopp enligt 3:12",
            "Skattesats över gränsbeloppet",
            "Om momsen är avdragsgill",
            "Marknadsmässigt förmånsvärde",
            "Fastighetens skattemässiga klassificering",
            "Klassificering i bolaget",
            "Eventuella begränsningar i ränteavdrag",
            "Vilka förbättringar som är avdragsgilla",
          ].map((item) => (
            <li key={item} className="flex items-center gap-2">
              <SourceTag source="TAX_ADVISOR_INPUT" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
