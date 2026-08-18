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
  { key: "corporateTaxRate", label: "Corporate tax", kind: "percent", source: "VERIFIED" },
  {
    key: "privateResidentialCapitalGainEffectiveRate",
    label: "Private residential effective capital gains tax",
    kind: "percent",
    source: "VERIFIED",
    hint: "Applied only when a scenario is explicitly classified as private residential property.",
  },
  { key: "capitalIncomeTaxRate", label: "Capital income tax", kind: "percent", source: "VERIFIED" },
  {
    key: "dividendTaxWithinAllowance",
    label: "Dividend tax within allowance",
    kind: "percent",
    source: "TAX_ADVISOR_INPUT",
    hint: "3:12 depends on actual circumstances — the allowance itself is entered per scenario.",
  },
  {
    key: "employerContributionRate",
    label: "Employer contributions",
    kind: "percent",
    source: "USER_INPUT",
  },
  { key: "privateStampDutyRate", label: "Stamp duty — private", kind: "percent", source: "VERIFIED" },
  {
    key: "companyStampDutyRate",
    label: "Stamp duty — legal entity",
    kind: "percent",
    source: "VERIFIED",
  },
  {
    key: "titleRegistrationFee",
    label: "Title registration fee",
    kind: "money",
    source: "VERIFIED",
  },
  { key: "mortgageDeedTaxRate", label: "New mortgage deed tax", kind: "percent", source: "VERIFIED" },
  {
    key: "mortgageDeedAdminFee",
    label: "Mortgage deed admin fee",
    kind: "money",
    source: "USER_INPUT",
    hint: "Set to the actual value once known.",
  },
  { key: "rotRate", label: "ROT rate", kind: "percent", source: "VERIFIED" },
  { key: "rotMaxPerPerson", label: "ROT max per person / year", kind: "money", source: "VERIFIED" },
  {
    key: "rentalStandardDeduction",
    label: "Rental standard deduction",
    kind: "money",
    source: "VERIFIED",
  },
  {
    key: "rentalPercentDeduction",
    label: "Rental percentage deduction",
    kind: "percent",
    source: "VERIFIED",
  },
  { key: "propertyFeeRate", label: "Municipal property fee", kind: "percent", source: "VERIFIED" },
  { key: "propertyFeeAnnualCap", label: "Property fee annual cap", kind: "money", source: "VERIFIED" },
  {
    key: "unsecuredLoanInterestDeductionRate",
    label: "Unsecured loan interest deduction",
    kind: "percent",
    source: "VERIFIED",
  },
  {
    key: "securedLoanInterestDeductionRateDefault",
    label: "Secured loan interest deduction (default)",
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
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="text-lg font-semibold tracking-tight">Tax configuration</h1>
      <p className="mt-0.5 mb-4 text-xs text-muted">
        Central, versioned tax config (version {TAX_CONFIG_VERSION}, tax year{" "}
        {DEFAULT_TAX_CONFIG_2026.taxYear}). Defaults are editable configuration, not business
        logic. Project overrides are stored separately and never overwritten by a change here.
      </p>

      <Card className="mb-4">
        <SelectField
          label="Project overrides"
          value={selectedId}
          options={[
            { value: "", label: "Global defaults (read-only reference)" },
            ...store.projects.map((p) => ({ value: p.id, label: p.name })),
          ]}
          onChange={setSelectedId}
        />
        {project && (
          <div className="mt-3 flex items-center gap-2">
            <Button onClick={toggleSnapshot}>
              {project.taxConfigSnapshot ? "Unlock tax snapshot" : "Lock tax snapshot"}
            </Button>
            <span className="text-[11px] text-muted">
              {project.taxConfigSnapshot
                ? `Locked ${project.taxConfigSnapshot.lockedAt?.slice(0, 10)} at version ${project.taxConfigSnapshot.sourceVersion} — global changes no longer affect this project.`
                : "Not locked — this project follows the global defaults plus its own overrides."}
            </span>
          </div>
        )}
      </Card>

      <Card
        title={project ? `Values used by ${project.name}` : "Global defaults"}
        subtitle={
          project
            ? "Editing a value here creates a project-specific override."
            : "Select a project above to override any of these."
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
                    Reset to default
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {!project && (
          <p className="mt-4 text-[11px] text-muted">
            Editing without a project selected has no effect — global defaults ship with the
            application and are versioned by tax year.
          </p>
        )}
      </Card>

      <Card className="mt-4" title="Values that must be supplied or advisor-verified">
        <ul className="grid gap-1.5 text-xs sm:grid-cols-2">
          {[
            "Exact employer contribution rate applicable",
            "Exact personal salary marginal tax",
            "Actual 3:12 dividend allowance",
            "Applicable tax above dividend allowance",
            "VAT deductibility",
            "Benefit taxation market value",
            "Property tax classification",
            "Company asset classification",
            "Interest deduction restrictions",
            "Capital-improvement deductibility",
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
