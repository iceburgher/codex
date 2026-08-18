import type { PropertyProject, ScenarioType } from "@/types";
import { isCompanyScenario } from "./engine";

export interface AdvisorQuestion {
  id: string;
  question: string;
  scope: string;
}

/** Checklist generated from the selected scenarios and the inputs actually used. */
export function buildAdvisorQuestions(
  project: PropertyProject,
  scenarios: ScenarioType[],
): AdvisorQuestion[] {
  const questions: AdvisorQuestion[] = [];
  const hasPrivate = scenarios.some((s) => !isCompanyScenario(s));
  const hasCompany = scenarios.some((s) => isCompanyScenario(s));

  if (hasPrivate) {
    questions.push(
      {
        id: "private_residence_qualification",
        scope: "Private purchase",
        question: "Will the property qualify as a private residential property for tax purposes?",
      },
      {
        id: "trading_risk",
        scope: "Private purchase",
        question:
          "Does the intended renovation-and-sale strategy create a risk of business/property trading treatment?",
      },
      {
        id: "improvement_basis",
        scope: "Private purchase",
        question: "Which renovation expenses qualify as capital improvement basis?",
      },
      {
        id: "dividend_allowance",
        scope: "Private purchase",
        question: `How much dividend allowance (3:12) is available for each owner in ${project.taxConfigSnapshot?.taxYear ?? 2026}?`,
      },
    );
  }

  if (hasCompany) {
    questions.push(
      {
        id: "vat_deductibility",
        scope: "Company purchase",
        question: "Is any renovation VAT deductible for this residential property?",
      },
      {
        id: "company_classification",
        scope: "Company purchase",
        question: "How should the property be classified in the company (capital asset vs inventory)?",
      },
      {
        id: "benefit_value",
        scope: "Company purchase",
        question: "What benefit value applies if the owners can use the property privately?",
      },
      {
        id: "interest_deductibility",
        scope: "Company purchase",
        question: "Are interest expenses fully deductible, including any intercompany interest?",
      },
      {
        id: "project_company",
        scope: "Company purchase",
        question: "Is a separate project company preferable for this project?",
      },
    );
  }

  if (project.rental.enabled) {
    questions.push({
      id: "rental_vat",
      scope: "Rental",
      question:
        "Does the planned letting pattern trigger VAT or hotel-like classification, and how is the rental result taxed?",
    });
  }

  if (project.inputs.holdingPeriodMonths < 12) {
    questions.push({
      id: "short_holding",
      scope: "Holding period",
      question:
        "Does a holding period under 12 months change the expected tax classification of the disposal?",
    });
  }

  return questions;
}
