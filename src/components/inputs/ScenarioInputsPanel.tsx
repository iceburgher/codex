"use client";

import { isCompanyScenario } from "@/calculations/engine";
import { SALARY_APPROXIMATION_WARNING } from "@/calculations/salary";
import type { PropertyProject, ScenarioInputs, ScenarioType } from "@/types";
import { SCENARIO_LABELS } from "@/types";
import { Collapsible, NumberField, PercentField, SelectField, ToggleField } from "../ui";

type Update = (updater: (draft: PropertyProject) => void) => void;

/** Ownership-, financing- and tax-treatment inputs for one scenario. */
export function ScenarioInputsPanel({
  project,
  scenarioType,
  update,
}: {
  project: PropertyProject;
  scenarioType: ScenarioType;
  update: Update;
}) {
  const scenario = project.scenarios[scenarioType];
  const isCompany = isCompanyScenario(scenarioType);

  const set = (mutate: (s: ScenarioInputs) => void) =>
    update((d) => mutate(d.scenarios[scenarioType]));

  return (
    <div className="space-y-2">
      <p className="px-1 text-[11px] text-muted">
        Det här gäller bara <strong>{SCENARIO_LABELS[scenarioType]}</strong>. Uppgifterna om
        objektet delas av alla ägarformer.
      </p>

      {!isCompany && (
        <>
          <Collapsible title="Privat finansiering" defaultOpen>
            <div className="space-y-3">
              <NumberField
                label="Egna pengar som finns"
                suffix="kr"
                value={scenario.privateFunding.existingPrivateCash}
                onChange={(v) => set((s) => void (s.privateFunding.existingPrivateCash = v ?? 0))}
              />
              <NumberField
                label="Utdelning som behövs, netto"
                suffix="kr"
                source="TAX_ADVISOR_INPUT"
                hint="Räknas upp till vad bolaget måste dela ut före skatt."
                value={scenario.privateFunding.targetNetDividend}
                onChange={(v) => set((s) => void (s.privateFunding.targetNetDividend = v ?? 0))}
              />
              <NumberField
                label="Lön som behövs, netto"
                suffix="kr"
                source="TAX_ADVISOR_INPUT"
                value={scenario.privateFunding.targetNetSalary}
                onChange={(v) => set((s) => void (s.privateFunding.targetNetSalary = v ?? 0))}
              />
            </div>
          </Collapsible>

          <Collapsible title="Privata lån" defaultOpen={scenarioType === "PRIVATE_DEBT"}>
            <div className="space-y-3">
              <NumberField
                label="Bolån"
                suffix="kr"
                value={scenario.privateLoans.mortgageAmount}
                onChange={(v) => set((s) => void (s.privateLoans.mortgageAmount = v ?? 0))}
              />
              <PercentField
                label="Ränta på bolån"
                value={scenario.privateLoans.mortgageInterestRate}
                onChange={(v) => set((s) => void (s.privateLoans.mortgageInterestRate = v ?? 0))}
              />
              <NumberField
                label="Uppläggningsavgift bolån"
                suffix="kr"
                value={scenario.privateLoans.mortgageSetupFee}
                onChange={(v) => set((s) => void (s.privateLoans.mortgageSetupFee = v ?? 0))}
              />
              <NumberField
                label="Amortering bolån per år"
                suffix="kr"
                hint="Påverkar kassaflödet och minskar skulden, men är ingen kostnad."
                value={scenario.privateLoans.mortgageAmortizationAnnual}
                onChange={(v) =>
                  set((s) => void (s.privateLoans.mortgageAmortizationAnnual = v ?? 0))
                }
              />
              <PercentField
                label="Ränteavdrag på bolån"
                source="TAX_ADVISOR_INPUT"
                value={scenario.privateLoans.securedLoanInterestDeductionRate}
                onChange={(v) =>
                  set((s) => void (s.privateLoans.securedLoanInterestDeductionRate = v ?? 0))
                }
              />
              <NumberField
                label="Privatlån utan säkerhet"
                suffix="kr"
                value={scenario.privateLoans.unsecuredLoanAmount}
                onChange={(v) => set((s) => void (s.privateLoans.unsecuredLoanAmount = v ?? 0))}
              />
              <PercentField
                label="Ränta på privatlån"
                value={scenario.privateLoans.unsecuredInterestRate}
                onChange={(v) => set((s) => void (s.privateLoans.unsecuredInterestRate = v ?? 0))}
              />
              <NumberField
                label="Uppläggningsavgift privatlån"
                suffix="kr"
                value={scenario.privateLoans.unsecuredSetupFee}
                onChange={(v) => set((s) => void (s.privateLoans.unsecuredSetupFee = v ?? 0))}
              />
              <NumberField
                label="Amortering privatlån per år"
                suffix="kr"
                value={scenario.privateLoans.unsecuredAmortizationAnnual}
                onChange={(v) =>
                  set((s) => void (s.privateLoans.unsecuredAmortizationAnnual = v ?? 0))
                }
              />
              <p className="text-[11px] text-warn">
                Ränta på privatlån utan säkerhet är inte avdragsgill från inkomstår 2026.
              </p>
            </div>
          </Collapsible>

          <Collapsible title="ROT-avdrag">
            <div className="space-y-3">
              <ToggleField
                label="Använd ROT-avdrag"
                value={scenario.rot.enabled}
                onChange={(v) => set((s) => void (s.rot.enabled = v))}
              />
              <NumberField
                label="Arbetskostnad som ger ROT"
                suffix="kr"
                value={scenario.rot.eligibleLaborCostGross}
                onChange={(v) => set((s) => void (s.rot.eligibleLaborCostGross = v ?? 0))}
              />
              <NumberField
                label="Antal personer med ROT-utrymme"
                value={scenario.rot.eligibleOwners}
                onChange={(v) => set((s) => void (s.rot.eligibleOwners = v ?? 0))}
              />
              <NumberField
                label="Kvar av årets ROT, ägare 1"
                suffix="kr"
                value={scenario.rot.remainingAllowancePerson1}
                onChange={(v) => set((s) => void (s.rot.remainingAllowancePerson1 = v ?? 0))}
              />
              <NumberField
                label="Kvar av årets ROT, ägare 2"
                suffix="kr"
                value={scenario.rot.remainingAllowancePerson2}
                onChange={(v) => set((s) => void (s.rot.remainingAllowancePerson2 = v ?? 0))}
              />
              <p className="text-[11px] text-muted">
                Den del som ROT betalar får inte samtidigt dras av mot kapitalvinsten.
              </p>
            </div>
          </Collapsible>
        </>
      )}

      {scenarioType === "EXISTING_COMPANY" && (
        <Collapsible title="Bolagets finansiering" defaultOpen>
          <div className="space-y-3">
            <NumberField
              label="Pengar från bolagets kassa"
              suffix="kr"
              value={scenario.companyFunding.companyCashInvested}
              onChange={(v) => set((s) => void (s.companyFunding.companyCashInvested = v ?? 0))}
            />
            <NumberField
              label="Företagslån"
              suffix="kr"
              value={scenario.companyFunding.externalBusinessLoan}
              onChange={(v) => set((s) => void (s.companyFunding.externalBusinessLoan = v ?? 0))}
            />
            <PercentField
              label="Ränta på företagslån"
              value={scenario.companyFunding.businessInterestRate}
              onChange={(v) => set((s) => void (s.companyFunding.businessInterestRate = v ?? 0))}
            />
            <NumberField
              label="Uppläggningsavgift"
              suffix="kr"
              value={scenario.companyFunding.setupFee}
              onChange={(v) => set((s) => void (s.companyFunding.setupFee = v ?? 0))}
            />
            <NumberField
              label="Borgensavgift"
              suffix="kr"
              value={scenario.companyFunding.guaranteeFee}
              onChange={(v) => set((s) => void (s.companyFunding.guaranteeFee = v ?? 0))}
            />
            <NumberField
              label="Amortering per år"
              suffix="kr"
              value={scenario.companyFunding.amortizationAnnual}
              onChange={(v) => set((s) => void (s.companyFunding.amortizationAnnual = v ?? 0))}
            />
            <PercentField
              label="Andel avdragsgill ränta"
              source="TAX_ADVISOR_INPUT"
              value={scenario.companyFunding.deductibleInterestPercent}
              onChange={(v) =>
                set((s) => void (s.companyFunding.deductibleInterestPercent = v ?? 0))
              }
            />
            <ToggleField
              label="Personlig borgen lämnas"
              value={scenario.companyFunding.personalGuarantee}
              onChange={(v) => set((s) => void (s.companyFunding.personalGuarantee = v))}
            />
          </div>
        </Collapsible>
      )}

      <Collapsible title="Utdelning">
        <div className="space-y-3">
          <NumberField
            label="Gränsbelopp enligt 3:12"
            suffix="kr"
            source="TAX_ADVISOR_INPUT"
            value={scenario.dividend.availableLowTaxAllowance}
            onChange={(v) => set((s) => void (s.dividend.availableLowTaxAllowance = v ?? 0))}
          />
          <PercentField
            label="Skatt inom gränsbeloppet"
            source="TAX_ADVISOR_INPUT"
            value={scenario.dividend.dividendTaxWithinAllowance}
            onChange={(v) => set((s) => void (s.dividend.dividendTaxWithinAllowance = v ?? 0))}
          />
          <PercentField
            label="Skatt över gränsbeloppet"
            source="TAX_ADVISOR_INPUT"
            allowNull
            hint="Lämnas den tom visas belopp över gränsbeloppet obeskattade — och flaggas."
            value={scenario.dividend.dividendTaxAboveAllowance}
            onChange={(v) => set((s) => void (s.dividend.dividendTaxAboveAllowance = v))}
          />
        </div>
      </Collapsible>

      <Collapsible title="Lön">
        <div className="space-y-3">
          <PercentField
            label="Marginalskatt på lön"
            source="TAX_ADVISOR_INPUT"
            value={scenario.salary.effectiveMarginalIncomeTaxRate}
            onChange={(v) => set((s) => void (s.salary.effectiveMarginalIncomeTaxRate = v ?? 0))}
          />
          <PercentField
            label="Arbetsgivaravgift"
            source="USER_INPUT"
            value={scenario.salary.employerContributionRate}
            onChange={(v) => set((s) => void (s.salary.employerContributionRate = v ?? 0))}
          />
          <p className="text-[11px] text-warn">{SALARY_APPROXIMATION_WARNING}</p>
        </div>
      </Collapsible>

      <Collapsible title="Moms">
        {/*
          Frågorna nedan avgör inte momsen — de avgör vilka frågor som är
          värda att ställa till rådgivaren, och när kalkylens antagande går
          på tvärs mot hur projektet faktiskt ska drivas.
        */}
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <SelectField
            label="Vem utför byggarbetet?"
            value={scenario.vat.buildWorkBy}
            onChange={(v) => update((d) => void (d.scenarios[scenarioType].vat.buildWorkBy = v))}
            options={[
              { value: "unknown", label: "Vet inte" },
              { value: "contractors", label: "Anlitade hantverkare" },
              { value: "own_staff", label: "Bolagets egen personal" },
            ]}
          />
          <SelectField
            label="Vad ska huset användas till?"
            value={scenario.vat.intendedUse}
            onChange={(v) => update((d) => void (d.scenarios[scenarioType].vat.intendedUse = v))}
            options={[
              { value: "unknown", label: "Vet inte" },
              { value: "sell_residential", label: "Säljas som bostad" },
              { value: "rent_residential", label: "Hyras ut som bostad" },
              {
                value: "rent_short_term_hotel_like",
                label: "Hyras ut kortvarigt, likt hotellverksamhet",
              },
              { value: "rent_commercial", label: "Hyras ut som lokal" },
              { value: "mixed", label: "Både bostad och lokal" },
            ]}
          />
          {(scenario.vat.intendedUse === "rent_commercial" ||
            scenario.vat.intendedUse === "mixed") && (
            <SelectField
              label="Är fastigheten frivilligt skattskyldig för moms?"
              value={scenario.vat.voluntaryTaxLiability}
              onChange={(v) =>
                update((d) => void (d.scenarios[scenarioType].vat.voluntaryTaxLiability = v))
              }
              options={[
                { value: "unknown", label: "Vet inte" },
                { value: "yes", label: "Ja" },
                { value: "no", label: "Nej" },
              ]}
              hint="Gäller bara lokaler, aldrig bostad."
            />
          )}
        </div>

        <div className="space-y-3">
          <SelectField
            label="Momshantering"
            source="TAX_ADVISOR_INPUT"
            value={scenario.vat.vatTreatment}
            options={[
              { value: "none", label: "Ingen (utgångspunkt för bostad)" },
              { value: "partial", label: "Delvis" },
              { value: "full", label: "Full" },
            ]}
            onChange={(v) => set((s) => void (s.vat.vatTreatment = v))}
          />
          <PercentField
            label="Andel avdragsgill moms"
            source="TAX_ADVISOR_INPUT"
            value={scenario.vat.vatDeductiblePercent}
            onChange={(v) => set((s) => void (s.vat.vatDeductiblePercent = v ?? 0))}
          />
          {scenario.vat.vatDeductiblePercent > 0 && (
            <p className="text-[11px] text-negative">
              Momsavdrag på bostad kräver särskilt stöd i skattereglerna. Stäm av med rådgivare.
            </p>
          )}
        </div>
      </Collapsible>

      {isCompany && (
        <Collapsible title="Privat användning och förmån" defaultOpen={scenario.privateUseLevel !== "none"}>
          <div className="space-y-3">
            <SelectField
              label="Hur mycket används huset privat?"
              value={scenario.privateUseLevel}
              options={[
                { value: "none", label: "Inte alls" },
                { value: "occasional", label: "Enstaka tillfällen" },
                { value: "frequent", label: "Ofta" },
                { value: "full_disposition", label: "Full dispositionsrätt" },
              ]}
              onChange={(v) => set((s) => void (s.privateUseLevel = v))}
            />
            <NumberField
              label="Marknadsmässigt förmånsvärde per år"
              suffix="kr"
              source="TAX_ADVISOR_INPUT"
              hint="Räknas aldrig fram automatiskt — fyll i ett värde från rådgivare."
              value={scenario.benefit.estimatedAnnualMarketBenefitValue}
              onChange={(v) =>
                set((s) => void (s.benefit.estimatedAnnualMarketBenefitValue = v ?? 0))
              }
            />
            <PercentField
              label="Ägarens skatt på förmånen"
              source="TAX_ADVISOR_INPUT"
              value={scenario.benefit.ownerIncomeTaxRateOnBenefit}
              onChange={(v) => set((s) => void (s.benefit.ownerIncomeTaxRateOnBenefit = v ?? 0))}
            />
            <PercentField
              label="Arbetsgivaravgift på förmånen"
              source="USER_INPUT"
              value={scenario.benefit.employerContributionRate}
              onChange={(v) => set((s) => void (s.benefit.employerContributionRate = v ?? 0))}
            />
            {scenario.privateUseLevel !== "none" && (
              <p className="rounded-md bg-danger-soft p-2 text-[11px] text-negative">
                Förmånsbeskattning kan utgå från själva dispositionsrätten, inte bara de dagar
                huset används. Ta in skatteråd innan ni litar på det här alternativet.
              </p>
            )}
          </div>
        </Collapsible>
      )}

      <Collapsible title="Skattemässig klassificering" defaultOpen>
        <div className="space-y-3">
          {!isCompany && (
            <SelectField
              label="Hur klassas fastigheten privat?"
              source="TAX_ADVISOR_INPUT"
              hint="22 % kapitalvinstskatt gäller bara om fastigheten uttryckligen räknas som privatbostad."
              value={scenario.privatePropertyTaxClassification}
              options={[
                { value: "private_residential_property", label: "Privatbostad" },
                { value: "business_property", label: "Näringsfastighet" },
                {
                  value: "property_trading_inventory_risk",
                  label: "Risk för handel med fastigheter",
                },
              ]}
              onChange={(v) => set((s) => void (s.privatePropertyTaxClassification = v))}
            />
          )}
          {isCompany && (
            <SelectField
              label="Hur klassas fastigheten i bolaget?"
              source="TAX_ADVISOR_INPUT"
              value={scenario.companyAssetClassification}
              options={[
                { value: "capital_asset", label: "Kapitaltillgång" },
                { value: "inventory_property", label: "Lagerfastighet" },
              ]}
              onChange={(v) => set((s) => void (s.companyAssetClassification = v))}
            />
          )}
          <PercentField
            label="Andel av renoveringen som får dras av mot vinsten"
            source="TAX_ADVISOR_INPUT"
            hint="Utgå aldrig från att hela renoveringen är avdragsgill mot kapitalvinsten."
            value={scenario.improvementBasis.fundamentalImprovementsPercent}
            onChange={(v) =>
              set((s) => void (s.improvementBasis.fundamentalImprovementsPercent = v ?? 0))
            }
          />
          <ToggleField
            label="Syftet är att renovera och sälja"
            value={scenario.flipIntent}
            onChange={(v) => set((s) => void (s.flipIntent = v))}
          />
          <ToggleField
            label="Klassificeringen är bekräftad av rådgivare"
            value={scenario.classificationConfirmedByAdvisor}
            onChange={(v) => set((s) => void (s.classificationConfirmedByAdvisor = v))}
          />
        </div>
      </Collapsible>

      <Collapsible title="Alternativkostnad">
        <PercentField
          label="Avkastning pengarna kunnat ge någon annanstans"
          source="ESTIMATE"
          value={scenario.opportunityCost.annualAlternativeReturnRate}
          onChange={(v) =>
            set((s) => void (s.opportunityCost.annualAlternativeReturnRate = v ?? 0))
          }
        />
      </Collapsible>
    </div>
  );
}
