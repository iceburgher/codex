"use client";

import { formatMoney } from "@/lib/format";
import type { PropertyProject, ScenarioType } from "@/types";
import { Card, NumberField, PercentField } from "../ui";

type Update = (updater: (draft: PropertyProject) => void) => void;

const PRIVATE: ScenarioType[] = ["PRIVATE_EQUITY", "PRIVATE_DEBT"];
const COMPANY: ScenarioType[] = ["EXISTING_COMPANY", "PROJECT_COMPANY"];

/**
 * De uppgifter som avgör hela kalkylen, inklusive lånet.
 *
 * Ett hus av den här storleken kräver lån oavsett vem som äger det, så
 * lånebelopp och ränta hör hemma här och gäller båda sidorna: privat som
 * bolån, i bolaget som företagslån — med var sin ränta, eftersom de
 * prissätts olika. Allt annat är finjustering.
 */
export function QuickFacts({
  project,
  update,
  onGoToRenovation,
  capitalNeeded,
}: {
  project: PropertyProject;
  update: Update;
  onGoToRenovation?: () => void;
  /** Vad projektet kräver totalt, för att kunna visa vad lånet inte täcker. */
  capitalNeeded?: number;
}) {
  const itemised = itemisedRenovation(project);
  const loan = sharedLoan(project);
  const privateRate = project.scenarios.PRIVATE_DEBT.privateLoans.mortgageInterestRate;
  const companyRate = project.scenarios.EXISTING_COMPANY.companyFunding.businessInterestRate;
  const ownMoney = capitalNeeded === undefined ? null : capitalNeeded - (loan ?? 0);

  return (
    <Card title="Grunduppgifter" subtitle="Ändra här så räknas båda alternativen om direkt.">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <NumberField
          label="Vad huset kostar"
          suffix="kr"
          size="lg"
          allowNull
          value={project.inputs.purchasePrice}
          onChange={(v) => update((d) => void (d.inputs.purchasePrice = v))}
        />

        <div>
          <NumberField
            label="Vad renoveringen kostar"
            suffix="kr"
            size="lg"
            hint={itemised === 0 ? "Dela upp på poster under Antaganden när offerter finns." : undefined}
            value={project.renovation.other}
            onChange={(v) => update((d) => void (d.renovation.other = v ?? 0))}
          />
          {itemised > 0 && (
            <button
              type="button"
              onClick={onGoToRenovation}
              className="mt-1 text-left text-xs text-muted hover:text-accent-strong"
            >
              + {formatMoney(itemised)} på enskilda poster ={" "}
              <span className="font-medium">{formatMoney(itemised + project.renovation.other)}</span>
            </button>
          )}
        </div>

        <NumberField
          label="Vad ni tror att ni kan sälja för"
          suffix="kr"
          size="lg"
          allowNull
          value={project.inputs.expectedSalePrice}
          onChange={(v) => update((d) => void (d.inputs.expectedSalePrice = v))}
        />

        <NumberField
          label="Hur mycket ni lånar"
          suffix="kr"
          size="lg"
          value={loan}
          hint="Gäller båda alternativen: bolån privat, företagslån i bolaget."
          onChange={(v) => update((d) => setSharedLoan(d, v ?? 0))}
        />

        <PercentField
          label="Ränta, bolån privat"
          value={privateRate}
          onChange={(v) => update((d) => setPrivateRate(d, v ?? 0))}
        />

        <PercentField
          label="Ränta, företagslån"
          value={companyRate}
          onChange={(v) => update((d) => setCompanyRate(d, v ?? 0))}
          hint="Ligger normalt högre än ett bolån."
        />

        <NumberField
          label="Hur länge ni äger huset"
          suffix="mån"
          size="lg"
          value={project.inputs.holdingPeriodMonths}
          onChange={(v) => update((d) => void (d.inputs.holdingPeriodMonths = v ?? 0))}
        />
      </div>

      <div className="mt-5 space-y-1 text-xs leading-relaxed text-muted">
        {ownMoney !== null && (
          <p>
            Med det lånet behöver ni lägga in{" "}
            <span className="numeric font-medium text-foreground">
              {formatMoney(Math.max(0, ownMoney))}
            </span>{" "}
            egna pengar — privat ur egen ficka, i bolaget ur kassan.
          </p>
        )}
        <p>
          Till renoveringen läggs {(project.renovation.contingencyPercent * 100).toFixed(0)} % för
          oförutsett. Ändra det under Antaganden.
        </p>
      </div>
    </Card>
  );
}

/** Lånet visas som ett tal så länge alternativen är överens om beloppet. */
function sharedLoan(project: PropertyProject): number {
  return project.scenarios.PRIVATE_DEBT.privateLoans.mortgageAmount;
}

/**
 * Räntorna hålls isär: ett företagslån mot en fastighet prissätts sällan som
 * ett bolån. Lånebeloppet är däremot detsamma, eftersom kapitalbehovet är det.
 */
function setPrivateRate(draft: PropertyProject, rate: number): void {
  for (const type of PRIVATE) draft.scenarios[type].privateLoans.mortgageInterestRate = rate;
}

function setCompanyRate(draft: PropertyProject, rate: number): void {
  for (const type of COMPANY) draft.scenarios[type].companyFunding.businessInterestRate = rate;
  draft.scenarios.PROJECT_COMPANY.projectCompanyFunding.externalInterestRate = rate;
}

function setSharedLoan(draft: PropertyProject, amount: number): void {
  for (const type of PRIVATE) draft.scenarios[type].privateLoans.mortgageAmount = amount;
  for (const type of COMPANY) draft.scenarios[type].companyFunding.externalBusinessLoan = amount;
  draft.scenarios.PROJECT_COMPANY.projectCompanyFunding.externalLoan = amount;
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
