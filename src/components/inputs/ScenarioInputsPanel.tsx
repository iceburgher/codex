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
        These inputs belong to <strong>{SCENARIO_LABELS[scenarioType]}</strong> only. Property
        facts above are shared by every scenario.
      </p>

      {!isCompany && (
        <>
          <Collapsible title="Private funding" defaultOpen>
            <div className="space-y-3">
              <NumberField
                label="Existing private cash"
                suffix="kr"
                value={scenario.privateFunding.existingPrivateCash}
                onChange={(v) => set((s) => void (s.privateFunding.existingPrivateCash = v ?? 0))}
              />
              <NumberField
                label="Net dividend needed from company"
                suffix="kr"
                source="TAX_ADVISOR_INPUT"
                hint="Grossed up below to show what the company must distribute."
                value={scenario.privateFunding.targetNetDividend}
                onChange={(v) => set((s) => void (s.privateFunding.targetNetDividend = v ?? 0))}
              />
              <NumberField
                label="Net salary needed from company"
                suffix="kr"
                source="TAX_ADVISOR_INPUT"
                value={scenario.privateFunding.targetNetSalary}
                onChange={(v) => set((s) => void (s.privateFunding.targetNetSalary = v ?? 0))}
              />
            </div>
          </Collapsible>

          <Collapsible title="Private loans" defaultOpen={scenarioType === "PRIVATE_DEBT"}>
            <div className="space-y-3">
              <NumberField
                label="Mortgage amount"
                suffix="kr"
                value={scenario.privateLoans.mortgageAmount}
                onChange={(v) => set((s) => void (s.privateLoans.mortgageAmount = v ?? 0))}
              />
              <PercentField
                label="Mortgage interest rate"
                value={scenario.privateLoans.mortgageInterestRate}
                onChange={(v) => set((s) => void (s.privateLoans.mortgageInterestRate = v ?? 0))}
              />
              <NumberField
                label="Mortgage setup fee"
                suffix="kr"
                value={scenario.privateLoans.mortgageSetupFee}
                onChange={(v) => set((s) => void (s.privateLoans.mortgageSetupFee = v ?? 0))}
              />
              <NumberField
                label="Mortgage amortization (annual)"
                suffix="kr"
                hint="Cash flow and debt reduction — not a project expense."
                value={scenario.privateLoans.mortgageAmortizationAnnual}
                onChange={(v) =>
                  set((s) => void (s.privateLoans.mortgageAmortizationAnnual = v ?? 0))
                }
              />
              <PercentField
                label="Secured interest deduction rate"
                source="TAX_ADVISOR_INPUT"
                value={scenario.privateLoans.securedLoanInterestDeductionRate}
                onChange={(v) =>
                  set((s) => void (s.privateLoans.securedLoanInterestDeductionRate = v ?? 0))
                }
              />
              <NumberField
                label="Unsecured loan amount"
                suffix="kr"
                value={scenario.privateLoans.unsecuredLoanAmount}
                onChange={(v) => set((s) => void (s.privateLoans.unsecuredLoanAmount = v ?? 0))}
              />
              <PercentField
                label="Unsecured interest rate"
                value={scenario.privateLoans.unsecuredInterestRate}
                onChange={(v) => set((s) => void (s.privateLoans.unsecuredInterestRate = v ?? 0))}
              />
              <NumberField
                label="Unsecured setup fee"
                suffix="kr"
                value={scenario.privateLoans.unsecuredSetupFee}
                onChange={(v) => set((s) => void (s.privateLoans.unsecuredSetupFee = v ?? 0))}
              />
              <NumberField
                label="Unsecured amortization (annual)"
                suffix="kr"
                value={scenario.privateLoans.unsecuredAmortizationAnnual}
                onChange={(v) =>
                  set((s) => void (s.privateLoans.unsecuredAmortizationAnnual = v ?? 0))
                }
              />
              <p className="text-[11px] text-warn">
                Unsecured loan interest is not deductible from income year 2026.
              </p>
            </div>
          </Collapsible>

          <Collapsible title="ROT">
            <div className="space-y-3">
              <ToggleField
                label="ROT enabled"
                value={scenario.rot.enabled}
                onChange={(v) => set((s) => void (s.rot.enabled = v))}
              />
              <NumberField
                label="Eligible labour cost (gross)"
                suffix="kr"
                value={scenario.rot.eligibleLaborCostGross}
                onChange={(v) => set((s) => void (s.rot.eligibleLaborCostGross = v ?? 0))}
              />
              <NumberField
                label="Eligible owners"
                value={scenario.rot.eligibleOwners}
                onChange={(v) => set((s) => void (s.rot.eligibleOwners = v ?? 0))}
              />
              <NumberField
                label="Remaining allowance — owner 1"
                suffix="kr"
                value={scenario.rot.remainingAllowancePerson1}
                onChange={(v) => set((s) => void (s.rot.remainingAllowancePerson1 = v ?? 0))}
              />
              <NumberField
                label="Remaining allowance — owner 2"
                suffix="kr"
                value={scenario.rot.remainingAllowancePerson2}
                onChange={(v) => set((s) => void (s.rot.remainingAllowancePerson2 = v ?? 0))}
              />
              <p className="text-[11px] text-muted">
                ROT-funded amounts are excluded from the capital-improvement tax basis.
              </p>
            </div>
          </Collapsible>
        </>
      )}

      {scenarioType === "EXISTING_COMPANY" && (
        <Collapsible title="Company funding" defaultOpen>
          <div className="space-y-3">
            <NumberField
              label="Company cash invested"
              suffix="kr"
              value={scenario.companyFunding.companyCashInvested}
              onChange={(v) => set((s) => void (s.companyFunding.companyCashInvested = v ?? 0))}
            />
            <NumberField
              label="External business loan"
              suffix="kr"
              value={scenario.companyFunding.externalBusinessLoan}
              onChange={(v) => set((s) => void (s.companyFunding.externalBusinessLoan = v ?? 0))}
            />
            <PercentField
              label="Business interest rate"
              value={scenario.companyFunding.businessInterestRate}
              onChange={(v) => set((s) => void (s.companyFunding.businessInterestRate = v ?? 0))}
            />
            <NumberField
              label="Setup fee"
              suffix="kr"
              value={scenario.companyFunding.setupFee}
              onChange={(v) => set((s) => void (s.companyFunding.setupFee = v ?? 0))}
            />
            <NumberField
              label="Guarantee fee"
              suffix="kr"
              value={scenario.companyFunding.guaranteeFee}
              onChange={(v) => set((s) => void (s.companyFunding.guaranteeFee = v ?? 0))}
            />
            <NumberField
              label="Amortization (annual)"
              suffix="kr"
              value={scenario.companyFunding.amortizationAnnual}
              onChange={(v) => set((s) => void (s.companyFunding.amortizationAnnual = v ?? 0))}
            />
            <PercentField
              label="Deductible interest share"
              source="TAX_ADVISOR_INPUT"
              value={scenario.companyFunding.deductibleInterestPercent}
              onChange={(v) =>
                set((s) => void (s.companyFunding.deductibleInterestPercent = v ?? 0))
              }
            />
            <ToggleField
              label="Personal guarantee given"
              value={scenario.companyFunding.personalGuarantee}
              onChange={(v) => set((s) => void (s.companyFunding.personalGuarantee = v))}
            />
          </div>
        </Collapsible>
      )}

      {scenarioType === "PROJECT_COMPANY" && (
        <Collapsible title="Project company funding" defaultOpen>
          <div className="space-y-3">
            <NumberField
              label="Share capital"
              suffix="kr"
              value={scenario.projectCompanyFunding.shareCapital}
              onChange={(v) => set((s) => void (s.projectCompanyFunding.shareCapital = v ?? 0))}
            />
            <NumberField
              label="Shareholder contribution"
              suffix="kr"
              value={scenario.projectCompanyFunding.shareholderContribution}
              onChange={(v) =>
                set((s) => void (s.projectCompanyFunding.shareholderContribution = v ?? 0))
              }
            />
            <NumberField
              label="Intercompany loan"
              suffix="kr"
              value={scenario.projectCompanyFunding.intercompanyLoan}
              onChange={(v) =>
                set((s) => void (s.projectCompanyFunding.intercompanyLoan = v ?? 0))
              }
            />
            <PercentField
              label="Intercompany interest rate"
              value={scenario.projectCompanyFunding.intercompanyInterestRate}
              onChange={(v) =>
                set((s) => void (s.projectCompanyFunding.intercompanyInterestRate = v ?? 0))
              }
            />
            <NumberField
              label="External loan"
              suffix="kr"
              value={scenario.projectCompanyFunding.externalLoan}
              onChange={(v) => set((s) => void (s.projectCompanyFunding.externalLoan = v ?? 0))}
            />
            <PercentField
              label="External interest rate"
              value={scenario.projectCompanyFunding.externalInterestRate}
              onChange={(v) =>
                set((s) => void (s.projectCompanyFunding.externalInterestRate = v ?? 0))
              }
            />
            <NumberField
              label="Annual accounting cost"
              suffix="kr"
              value={scenario.projectCompanyFunding.annualAccountingCost}
              onChange={(v) =>
                set((s) => void (s.projectCompanyFunding.annualAccountingCost = v ?? 0))
              }
            />
            <NumberField
              label="Annual banking cost"
              suffix="kr"
              value={scenario.projectCompanyFunding.annualBankingCost}
              onChange={(v) =>
                set((s) => void (s.projectCompanyFunding.annualBankingCost = v ?? 0))
              }
            />
            <NumberField
              label="Annual admin cost"
              suffix="kr"
              value={scenario.projectCompanyFunding.annualAdminCost}
              onChange={(v) =>
                set((s) => void (s.projectCompanyFunding.annualAdminCost = v ?? 0))
              }
            />
          </div>
        </Collapsible>
      )}

      <Collapsible title="Dividend extraction">
        <div className="space-y-3">
          <NumberField
            label="Available low-tax allowance (3:12)"
            suffix="kr"
            source="TAX_ADVISOR_INPUT"
            value={scenario.dividend.availableLowTaxAllowance}
            onChange={(v) => set((s) => void (s.dividend.availableLowTaxAllowance = v ?? 0))}
          />
          <PercentField
            label="Dividend tax within allowance"
            source="TAX_ADVISOR_INPUT"
            value={scenario.dividend.dividendTaxWithinAllowance}
            onChange={(v) => set((s) => void (s.dividend.dividendTaxWithinAllowance = v ?? 0))}
          />
          <PercentField
            label="Dividend tax above allowance"
            source="TAX_ADVISOR_INPUT"
            allowNull
            hint="Left blank, amounts above the allowance are shown untaxed and flagged."
            value={scenario.dividend.dividendTaxAboveAllowance}
            onChange={(v) => set((s) => void (s.dividend.dividendTaxAboveAllowance = v))}
          />
        </div>
      </Collapsible>

      <Collapsible title="Salary extraction">
        <div className="space-y-3">
          <PercentField
            label="Effective marginal income tax rate"
            source="TAX_ADVISOR_INPUT"
            value={scenario.salary.effectiveMarginalIncomeTaxRate}
            onChange={(v) => set((s) => void (s.salary.effectiveMarginalIncomeTaxRate = v ?? 0))}
          />
          <PercentField
            label="Employer contribution rate"
            source="USER_INPUT"
            value={scenario.salary.employerContributionRate}
            onChange={(v) => set((s) => void (s.salary.employerContributionRate = v ?? 0))}
          />
          <p className="text-[11px] text-warn">{SALARY_APPROXIMATION_WARNING}</p>
        </div>
      </Collapsible>

      <Collapsible title="VAT">
        <div className="space-y-3">
          <SelectField
            label="VAT treatment"
            source="TAX_ADVISOR_INPUT"
            value={scenario.vat.vatTreatment}
            options={[
              { value: "none", label: "None (default for residential)" },
              { value: "partial", label: "Partial" },
              { value: "full", label: "Full" },
            ]}
            onChange={(v) => set((s) => void (s.vat.vatTreatment = v))}
          />
          <PercentField
            label="Deductible VAT share"
            source="TAX_ADVISOR_INPUT"
            value={scenario.vat.vatDeductiblePercent}
            onChange={(v) => set((s) => void (s.vat.vatDeductiblePercent = v ?? 0))}
          />
          {scenario.vat.vatDeductiblePercent > 0 && (
            <p className="text-[11px] text-negative">
              Residential VAT deduction requires specific tax support. Verify with advisor.
            </p>
          )}
        </div>
      </Collapsible>

      {isCompany && (
        <Collapsible title="Private use / benefit" defaultOpen={scenario.privateUseLevel !== "none"}>
          <div className="space-y-3">
            <SelectField
              label="Private use level"
              value={scenario.privateUseLevel}
              options={[
                { value: "none", label: "None" },
                { value: "occasional", label: "Occasional" },
                { value: "frequent", label: "Frequent" },
                { value: "full_disposition", label: "Full disposition right" },
              ]}
              onChange={(v) => set((s) => void (s.privateUseLevel = v))}
            />
            <NumberField
              label="Annual market benefit value"
              suffix="kr"
              source="TAX_ADVISOR_INPUT"
              hint="Never inferred automatically — supply an advisor-verified value."
              value={scenario.benefit.estimatedAnnualMarketBenefitValue}
              onChange={(v) =>
                set((s) => void (s.benefit.estimatedAnnualMarketBenefitValue = v ?? 0))
              }
            />
            <PercentField
              label="Owner income tax rate on benefit"
              source="TAX_ADVISOR_INPUT"
              value={scenario.benefit.ownerIncomeTaxRateOnBenefit}
              onChange={(v) => set((s) => void (s.benefit.ownerIncomeTaxRateOnBenefit = v ?? 0))}
            />
            <PercentField
              label="Employer contribution rate on benefit"
              source="USER_INPUT"
              value={scenario.benefit.employerContributionRate}
              onChange={(v) => set((s) => void (s.benefit.employerContributionRate = v ?? 0))}
            />
            {scenario.privateUseLevel !== "none" && (
              <p className="rounded-md bg-danger-soft p-2 text-[11px] text-negative">
                Benefit taxation may be based on the right to use the property, not only actual
                days used. Obtain tax advice before relying on this scenario.
              </p>
            )}
          </div>
        </Collapsible>
      )}

      <Collapsible title="Tax classification" defaultOpen>
        <div className="space-y-3">
          {!isCompany && (
            <SelectField
              label="Private property tax classification"
              source="TAX_ADVISOR_INPUT"
              hint="22% effective capital gains tax applies only to an explicit private residential classification."
              value={scenario.privatePropertyTaxClassification}
              options={[
                { value: "private_residential_property", label: "Private residential property" },
                { value: "business_property", label: "Business property" },
                {
                  value: "property_trading_inventory_risk",
                  label: "Property trading / inventory risk",
                },
              ]}
              onChange={(v) => set((s) => void (s.privatePropertyTaxClassification = v))}
            />
          )}
          {isCompany && (
            <SelectField
              label="Company asset classification"
              source="TAX_ADVISOR_INPUT"
              value={scenario.companyAssetClassification}
              options={[
                { value: "capital_asset", label: "Capital asset" },
                { value: "inventory_property", label: "Inventory property" },
              ]}
              onChange={(v) => set((s) => void (s.companyAssetClassification = v))}
            />
          )}
          <PercentField
            label="Renovation qualifying as improvement basis"
            source="TAX_ADVISOR_INPUT"
            hint="Never assume all renovation is deductible against the capital gain."
            value={scenario.improvementBasis.fundamentalImprovementsPercent}
            onChange={(v) =>
              set((s) => void (s.improvementBasis.fundamentalImprovementsPercent = v ?? 0))
            }
          />
          <ToggleField
            label="Renovate-and-sell (flip) intent"
            value={scenario.flipIntent}
            onChange={(v) => set((s) => void (s.flipIntent = v))}
          />
          <ToggleField
            label="Classification confirmed by advisor"
            value={scenario.classificationConfirmedByAdvisor}
            onChange={(v) => set((s) => void (s.classificationConfirmedByAdvisor = v))}
          />
        </div>
      </Collapsible>

      <Collapsible title="Opportunity cost">
        <PercentField
          label="Alternative annual return on capital"
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
