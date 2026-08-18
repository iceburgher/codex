import type { PropertyProject, ScenarioType } from "@/types";
import { isCompanyScenario } from "./engine";

export interface AdvisorQuestion {
  id: string;
  question: string;
  scope: string;
}

/** Checklista som byggs av de scenarier och indata som faktiskt används. */
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
        scope: "Privat köp",
        question: "Räknas fastigheten som privatbostad skattemässigt?",
      },
      {
        id: "trading_risk",
        scope: "Privat köp",
        question:
          "Innebär upplägget att renovera och sälja en risk för att det ses som näringsverksamhet eller handel med fastigheter?",
      },
      {
        id: "improvement_basis",
        scope: "Privat köp",
        question: "Vilka renoveringskostnader får dras av som förbättringsutgifter vid försäljning?",
      },
      {
        id: "dividend_allowance",
        scope: "Privat köp",
        question: `Hur stort gränsbelopp för utdelning har varje ägare ${project.taxConfigSnapshot?.taxYear ?? 2026}?`,
      },
    );
  }

  if (hasCompany) {
    questions.push(
      {
        id: "vat_deductibility",
        scope: "Bolagsköp",
        question: "Är någon del av renoveringsmomsen avdragsgill för den här bostaden?",
      },
      {
        id: "company_classification",
        scope: "Bolagsköp",
        question: "Hur ska fastigheten klassificeras i bolaget — kapitaltillgång eller lagerfastighet?",
      },
      {
        id: "benefit_value",
        scope: "Bolagsköp",
        question: "Vilket förmånsvärde gäller om ägarna kan använda huset privat?",
      },
      {
        id: "interest_deductibility",
        scope: "Bolagsköp",
        question: "Är räntekostnaderna fullt avdragsgilla, även på eventuellt koncernlån?",
      },
      {
        id: "project_company",
        scope: "Bolagsköp",
        question: "Är ett separat projektbolag att föredra för det här projektet?",
      },
    );
  }

  if (project.rental.enabled) {
    questions.push({
      id: "rental_vat",
      scope: "Uthyrning",
      question:
        "Innebär den planerade uthyrningen moms eller att verksamheten liknar hotell, och hur beskattas resultatet?",
    });
  }

  if (project.inputs.holdingPeriodMonths < 12) {
    questions.push({
      id: "short_holding",
      scope: "Innehavstid",
      question:
        "Ändrar en innehavstid under 12 månader den skattemässiga bedömningen av försäljningen?",
    });
  }

  return questions;
}
