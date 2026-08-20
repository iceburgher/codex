"use client";

import { useState } from "react";
import { ALL_SCENARIOS } from "@/lib/defaults";
import { formatMoney, whenAssessable } from "@/lib/format";
import type { PropertyProject, ScenarioResult, ScenarioType } from "@/types";
import { SCENARIO_LABELS } from "@/types";
import { PROPERTY_TYPES } from "../inputs/ObjectInputs";
import { Button, Card, NumberField, PercentField, SelectField, TextField, ToggleField } from "../ui";

type Update = (updater: (draft: PropertyProject) => void) => void;

const PRIVATE_SCENARIOS: ScenarioType[] = ["PRIVATE_EQUITY", "PRIVATE_DEBT"];

function activePrivate(project: PropertyProject): ScenarioType[] {
  return project.compareScenarios.filter((s) => PRIVATE_SCENARIOS.includes(s));
}

function companyActive(project: PropertyProject): boolean {
  return project.compareScenarios.includes("EXISTING_COMPANY");
}

function debtActive(project: PropertyProject): boolean {
  return project.compareScenarios.includes("PRIVATE_DEBT");
}

/** Skriver samma privata uppgift till alla aktiva privata alternativ, så de inte glider isär. */
function setPrivate(draft: PropertyProject, mutate: (s: PropertyProject["scenarios"][ScenarioType]) => void) {
  for (const t of PRIVATE_SCENARIOS) {
    if (draft.compareScenarios.includes(t)) mutate(draft.scenarios[t]);
  }
}

const STEP_TITLES = [
  "Sätt att äga huset",
  "Objektet",
  "Renovering",
  "Finansiering av köpet",
  "Kontantinsatsen",
  "Ägandetid och användning",
  "Försäljning",
  "Klart",
];

/**
 * Guidad genomgång, steg för steg, för den som inte vill möta alla fält på
 * en gång. Privat och bolag hålls isär i egna kort så länge de förekommer i
 * samma steg — de är två helt separata affärer, inte varianter av samma fråga.
 *
 * Inga nya beräkningar eller fält — bara en annan ordning på precis samma
 * data som Antaganden-fliken redan skriver till.
 */
export function GuidedWizard({
  project,
  update,
  results,
  onFinish,
}: {
  project: PropertyProject;
  update: Update;
  results: ScenarioResult[];
  onFinish: () => void;
}) {
  const [step, setStep] = useState(0);
  const last = STEP_TITLES.length - 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {STEP_TITLES.map((title, i) => (
          <button
            key={title}
            type="button"
            onClick={() => setStep(i)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
              i === step
                ? "bg-ink text-white"
                : i < step
                  ? "bg-positive-soft text-positive"
                  : "bg-surface text-muted hover:text-foreground"
            }`}
          >
            {i + 1}. {title}
          </button>
        ))}
      </div>

      {step === 0 && <StepScenarios project={project} update={update} />}
      {step === 1 && <StepObject project={project} update={update} />}
      {step === 2 && <StepRenovation project={project} update={update} />}
      {step === 3 && <StepFinancing project={project} update={update} />}
      {step === 4 && <StepDownPayment project={project} update={update} />}
      {step === 5 && <StepUsage project={project} update={update} />}
      {step === 6 && <StepSale project={project} update={update} />}
      {step === 7 && <StepSummary results={results} onFinish={onFinish} />}

      {step < last && (
        <div className="flex items-center justify-between">
          <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            ← Föregående
          </Button>
          <Button
            variant="primary"
            disabled={step === 0 && project.compareScenarios.length === 0}
            onClick={() => setStep((s) => Math.min(last, s + 1))}
          >
            Nästa →
          </Button>
        </div>
      )}
    </div>
  );
}

function StepScenarios({ project, update }: { project: PropertyProject; update: Update }) {
  return (
    <Card
      title="Vilka sätt vill ni jämföra?"
      subtitle="Ni kan välja flera. Privat och bolag räknas som två helt separata affärer — appen blandar aldrig ihop underlagen."
    >
      <div className="space-y-2.5">
        {ALL_SCENARIOS.map((s) => (
          <ToggleField
            key={s}
            label={SCENARIO_LABELS[s]}
            value={project.compareScenarios.includes(s)}
            onChange={(on) =>
              update((d) => {
                d.compareScenarios = on
                  ? ALL_SCENARIOS.filter((x) => d.compareScenarios.includes(x) || x === s)
                  : d.compareScenarios.filter((x) => x !== s);
                if (!d.compareScenarios.includes(d.selectedScenario)) {
                  d.selectedScenario = d.compareScenarios[0] ?? "PRIVATE_EQUITY";
                }
              })
            }
          />
        ))}
      </div>
      {project.compareScenarios.length === 0 && (
        <p className="mt-3 text-xs text-warn">Välj minst ett för att komma vidare.</p>
      )}
    </Card>
  );
}

function StepObject({ project, update }: { project: PropertyProject; update: Update }) {
  return (
    <Card title="Mata in objektet" subtitle="Det här gäller oavsett hur ni väljer att äga huset.">
      <div className="grid gap-4 sm:grid-cols-2">
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
        <SelectField
          label="Typ av objekt"
          value={project.facts.propertyType}
          options={PROPERTY_TYPES}
          onChange={(v) => update((d) => void (d.facts.propertyType = v))}
        />
        <NumberField
          label="Vad köper ni det för?"
          suffix="kr"
          size="lg"
          allowNull
          value={project.inputs.purchasePrice}
          onChange={(v) => update((d) => void (d.inputs.purchasePrice = v))}
        />
      </div>
    </Card>
  );
}

function StepRenovation({ project, update }: { project: PropertyProject; update: Update }) {
  return (
    <Card
      title="Vad kostar renoveringen?"
      subtitle="Grovt uppskattat räcker för att komma igång — dela upp den i poster under Antaganden när ni har offerter."
    >
      <NumberField
        label="Renovering, totalt"
        suffix="kr"
        size="lg"
        value={project.renovation.other}
        onChange={(v) => update((d) => void (d.renovation.other = v ?? 0))}
      />
      <p className="mt-3 text-xs text-muted">
        Till detta läggs {(project.renovation.contingencyPercent * 100).toFixed(0)} % för
        oförutsett, som går att ändra under Antaganden.
      </p>
    </Card>
  );
}

function StepFinancing({ project, update }: { project: PropertyProject; update: Update }) {
  const showPrivate = activePrivate(project).length > 0;
  const showCompany = companyActive(project);
  const showLoan = debtActive(project);
  const firstPrivate = activePrivate(project)[0];

  return (
    <div>
      <p className="mb-3 text-sm text-muted">
        Hur finansierar ni köpet — lånar ni, och hur mycket egna pengar behöver ni stoppa in?
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {showPrivate && (
          <Card
            title="Spår 1 — Privat"
            className="border-l-4 border-l-accent"
            subtitle="Bolån, om något, samt kontantinsatsens storlek."
          >
            {showLoan ? (
              <div className="space-y-3">
                <NumberField
                  label="Bolån"
                  suffix="kr"
                  value={project.scenarios.PRIVATE_DEBT.privateLoans.mortgageAmount}
                  onChange={(v) =>
                    update(
                      (d) => void (d.scenarios.PRIVATE_DEBT.privateLoans.mortgageAmount = v ?? 0),
                    )
                  }
                />
                <PercentField
                  label="Ränta på bolån"
                  value={project.scenarios.PRIVATE_DEBT.privateLoans.mortgageInterestRate}
                  onChange={(v) =>
                    update(
                      (d) =>
                        void (d.scenarios.PRIVATE_DEBT.privateLoans.mortgageInterestRate = v ?? 0),
                    )
                  }
                />
              </div>
            ) : (
              <p className="text-sm text-muted">
                &quot;Privat, utan lån&quot; är valt — inget lån att fylla i här.
              </p>
            )}
            {firstPrivate && (
              <div className="mt-3">
                <PercentField
                  label="Krävd kontantinsats"
                  source="TAX_ADVISOR_INPUT"
                  hint="Andel av köpeskillingen bolånet högst får täcka (svensk standard 15 %)."
                  value={project.scenarios[firstPrivate].downPaymentRequirementPercent}
                  onChange={(v) =>
                    update((d) =>
                      setPrivate(d, (s) => void (s.downPaymentRequirementPercent = v ?? 0)),
                    )
                  }
                />
              </div>
            )}
          </Card>
        )}

        {showCompany && (
          <Card
            title="Spår 2 — Bolag"
            className="border-l-4 border-l-ink"
            subtitle="Företagslån samt kontantinsatsens storlek."
          >
            <div className="space-y-3">
              <NumberField
                label="Företagslån"
                suffix="kr"
                value={project.scenarios.EXISTING_COMPANY.companyFunding.externalBusinessLoan}
                onChange={(v) =>
                  update(
                    (d) =>
                      void (d.scenarios.EXISTING_COMPANY.companyFunding.externalBusinessLoan =
                        v ?? 0),
                  )
                }
              />
              <PercentField
                label="Ränta på företagslån"
                value={project.scenarios.EXISTING_COMPANY.companyFunding.businessInterestRate}
                onChange={(v) =>
                  update(
                    (d) =>
                      void (d.scenarios.EXISTING_COMPANY.companyFunding.businessInterestRate =
                        v ?? 0),
                  )
                }
              />
              <PercentField
                label="Krävd kontantinsats"
                source="TAX_ADVISOR_INPUT"
                hint="Ingen lagreglering som för privata bolån, men banker ställer ofta liknande krav."
                value={project.scenarios.EXISTING_COMPANY.downPaymentRequirementPercent}
                onChange={(v) =>
                  update(
                    (d) =>
                      void (d.scenarios.EXISTING_COMPANY.downPaymentRequirementPercent = v ?? 0),
                  )
                }
              />
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function StepDownPayment({ project, update }: { project: PropertyProject; update: Update }) {
  const showPrivate = activePrivate(project).length > 0;
  const showCompany = companyActive(project);
  const firstPrivate = activePrivate(project)[0];

  return (
    <div>
      <p className="mb-3 text-sm text-muted">
        Hur finansierar ni kontantinsatsen — egna pengar, eller något annat?
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {showPrivate && firstPrivate && (
          <Card title="Spår 1 — Privat" className="border-l-4 border-l-accent">
            <div className="space-y-3">
              <NumberField
                label="Egna pengar som finns"
                suffix="kr"
                value={project.scenarios[firstPrivate].privateFunding.existingPrivateCash}
                onChange={(v) =>
                  update((d) =>
                    setPrivate(d, (s) => void (s.privateFunding.existingPrivateCash = v ?? 0)),
                  )
                }
              />
              <NumberField
                label="Annan finansiering"
                suffix="kr"
                hint="T.ex. gåva, arv eller försäljning av annan tillgång. Skattebehandlingen av källan kan appen inte veta eller anta."
                value={project.scenarios[firstPrivate].privateFunding.otherFunding}
                onChange={(v) =>
                  update((d) => setPrivate(d, (s) => void (s.privateFunding.otherFunding = v ?? 0)))
                }
              />
              <NumberField
                label="Lån från eget bolag"
                suffix="kr"
                source="TAX_ADVISOR_INPUT"
                hint="Om ni tänker finansiera kontantinsatsen med pengar ur ett bolag ni äger."
                value={project.scenarios[firstPrivate].privateLoans.companyLoanAmount}
                onChange={(v) =>
                  update((d) =>
                    setPrivate(d, (s) => void (s.privateLoans.companyLoanAmount = v ?? 0)),
                  )
                }
              />
            </div>
          </Card>
        )}

        {showCompany && (
          <Card title="Spår 2 — Bolag" className="border-l-4 border-l-ink">
            <div className="space-y-3">
              <NumberField
                label="Pengar från bolagets kassa"
                suffix="kr"
                value={project.scenarios.EXISTING_COMPANY.companyFunding.companyCashInvested}
                onChange={(v) =>
                  update(
                    (d) =>
                      void (d.scenarios.EXISTING_COMPANY.companyFunding.companyCashInvested =
                        v ?? 0),
                  )
                }
              />
              <NumberField
                label="Aktieägartillskott"
                suffix="kr"
                hint="Eget kapital, ingen skuld. Återbetalas inte automatiskt."
                value={project.scenarios.EXISTING_COMPANY.companyFunding.shareholderContribution}
                onChange={(v) =>
                  update(
                    (d) =>
                      void (d.scenarios.EXISTING_COMPANY.companyFunding.shareholderContribution =
                        v ?? 0),
                  )
                }
              />
              <NumberField
                label="Ägarlån till bolaget"
                suffix="kr"
                source="TAX_ADVISOR_INPUT"
                hint="En skuld bolaget har till ägaren. Återbetalning av lånebeloppet är varken utdelning eller lön."
                value={project.scenarios.EXISTING_COMPANY.companyFunding.ownerLoanAmount}
                onChange={(v) =>
                  update(
                    (d) =>
                      void (d.scenarios.EXISTING_COMPANY.companyFunding.ownerLoanAmount = v ?? 0),
                  )
                }
              />
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function StepUsage({ project, update }: { project: PropertyProject; update: Update }) {
  const showCompany = companyActive(project);

  return (
    <div className="space-y-4">
      <Card
        title="Hur länge äger ni huset?"
        subtitle="Gäller oavsett hur ni väljer att äga det."
      >
        <NumberField
          label="Ägandetid"
          suffix="mån"
          size="lg"
          value={project.inputs.holdingPeriodMonths}
          onChange={(v) => update((d) => void (d.inputs.holdingPeriodMonths = v ?? 0))}
        />
      </Card>

      <Card
        title="Hur disponerar ni huset under tiden?"
        subtitle="Privat användning, eller uthyrning — t.ex. Airbnb."
      >
        <div className="space-y-3">
          <ToggleField
            label="Huset ska hyras ut"
            value={project.rental.enabled}
            onChange={(v) => update((d) => void (d.rental.enabled = v))}
          />
          {project.rental.enabled && (
            <div className="grid gap-3 sm:grid-cols-2">
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
            </div>
          )}
        </div>
      </Card>

      {showCompany && (
        <Card
          title="Spår 2 — Bolag: privat användning"
          className="border-l-4 border-l-ink"
          subtitle="Använder ägaren huset privat medan det ägs av bolaget måste det förmånsbeskattas — det räknas separat från uthyrningen ovan."
        >
          <SelectField
            label="Hur mycket används huset privat?"
            value={project.scenarios.EXISTING_COMPANY.privateUseLevel}
            options={[
              { value: "none", label: "Inte alls" },
              { value: "occasional", label: "Enstaka tillfällen" },
              { value: "frequent", label: "Ofta" },
              { value: "full_disposition", label: "Full dispositionsrätt" },
            ]}
            onChange={(v) =>
              update((d) => void (d.scenarios.EXISTING_COMPANY.privateUseLevel = v))
            }
          />
          {project.scenarios.EXISTING_COMPANY.privateUseLevel !== "none" && (
            <p className="mt-2 text-xs text-warn">
              Fyll i förmånsvärdet under Antaganden → Privat användning och förmån. Det räknas
              aldrig fram automatiskt.
            </p>
          )}
        </Card>
      )}
    </div>
  );
}

function StepSale({ project, update }: { project: PropertyProject; update: Update }) {
  return (
    <Card
      title="Vad tror ni att ni kan sälja för?"
      subtitle="Ett tips för att räkna på — går alltid att ändra senare."
    >
      <NumberField
        label="Förväntat försäljningspris"
        suffix="kr"
        size="lg"
        allowNull
        value={project.inputs.expectedSalePrice}
        onChange={(v) => update((d) => void (d.inputs.expectedSalePrice = v))}
      />
    </Card>
  );
}

function StepSummary({
  results,
  onFinish,
}: {
  results: ScenarioResult[];
  onFinish: () => void;
}) {
  return (
    <Card
      title="Klart — så här ser det ut just nu"
      subtitle="Privat och bolag redovisas separat, precis som de är två separata affärer."
    >
      <div className="space-y-3">
        {results.map((r) => (
          <div
            key={r.scenario}
            className="flex flex-wrap items-baseline justify-between gap-3 rounded-2xl bg-surface-muted px-4 py-3"
          >
            <span className="text-sm font-medium">{r.label}</span>
            <span className="flex items-baseline gap-4">
              <span className="text-xs text-muted">
                Kapitalbehov{" "}
                <span className="numeric font-medium text-foreground">
                  {formatMoney(r.totalCapitalRequirement)}
                </span>
              </span>
              <span className="text-xs text-muted">
                Vinst efter skatt{" "}
                <span className="numeric font-medium text-foreground">
                  {whenAssessable(r.salePriceMissing, () => formatMoney(r.profitAfterTax))}
                </span>
              </span>
            </span>
          </div>
        ))}
      </div>
      <div className="mt-5">
        <Button variant="primary" onClick={onFinish}>
          Se hela resultatet →
        </Button>
      </div>
    </Card>
  );
}
