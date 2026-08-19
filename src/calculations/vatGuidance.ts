import type { RiskFlag, ScenarioInputs, ScenarioType, VatInputs } from "@/types";
import { isCompanyScenario } from "./engine";

/**
 * Vägledning kring moms vid fastighetsförädling i bolag.
 *
 * Modulen avgör aldrig om moms får dras av. Den tar de faktafrågor ägarna
 * själva kan svara på — vem som bygger, vad huset ska användas till, om
 * fastigheten är frivilligt skattskyldig — och pekar ut vilka frågor som
 * behöver ställas till någon som kan svara, samt när ett antagande i kalkylen
 * går på tvärs mot de svaren.
 *
 * Skälet till uppdelningen: momsen beror på verksamhetens art, och det är en
 * bedömning. Att koda den som automatik vore att låtsas om en säkerhet appen
 * inte har.
 */

export interface VatQuestion {
  id: string;
  question: string;
  /** Varför frågan dyker upp, så att den går att ta med till rådgivaren. */
  because: string;
}

const RESIDENTIAL_USES = new Set(["sell_residential", "rent_residential"]);

export function vatQuestions(vat: VatInputs): VatQuestion[] {
  const questions: VatQuestion[] = [];

  if (vat.intendedUse === "unknown") {
    questions.push({
      id: "vat_use_unknown",
      question: "Ska huset säljas som bostad, hyras ut som bostad eller användas som lokal?",
      because: "Momsen beror på vad verksamheten är, och det är inte ifyllt.",
    });
  }

  if (RESIDENTIAL_USES.has(vat.intendedUse)) {
    questions.push({
      id: "vat_residential_exempt",
      question:
        "Bekräfta att renoveringsmomsen inte är avdragsgill när huset säljs eller hyrs ut som bostad.",
      because: "Att sälja och hyra ut bostad är momsfritt, och då brukar avdragsrätt saknas.",
    });
  }

  if (vat.intendedUse === "rent_short_term_hotel_like") {
    questions.push({
      id: "vat_hotel_classification",
      question:
        "Liknar uthyrningen hotellverksamhet så mycket — korta vistelser, hög gästomsättning, städning eller annan service ingår — att den är momspliktig i stället för momsfri bostadsuthyrning?",
      because:
        "Rumsuthyrning i hotellrörelse eller liknande är momspliktig, till skillnad från vanlig bostadsuthyrning, vilket också öppnar för avdrag på renoveringsmomsen. Gränsen mot vanlig uthyrning är oskarp och avgörs i praktiken från fall till fall.",
    });
  }

  if (vat.intendedUse === "rent_commercial" || vat.intendedUse === "mixed") {
    questions.push({
      id: "vat_voluntary_liability",
      question:
        "Kan fastigheten bli frivilligt skattskyldig för moms, och vad krävs i så fall av hyresgästen?",
      because: "Uthyrning till lokal kan ge avdragsrätt, men bara under vissa förutsättningar.",
    });

    if (vat.intendedUse === "mixed") {
      questions.push({
        id: "vat_mixed_split",
        question: "Hur ska momsen fördelas mellan den momsfria och den momspliktiga delen?",
        because: "Blandad användning ger bara avdrag för den momspliktiga delen.",
      });
    }
  }

  if (vat.buildWorkBy === "own_staff") {
    questions.push({
      id: "vat_own_staff",
      question:
        "Utlöser byggarbete i egen regi uttagsbeskattning, och hur ska det i så fall värderas?",
      because: "Bolaget utför arbetet med egen personal, inte genom anlitade hantverkare.",
    });
  }

  if (vat.buildWorkBy === "contractors") {
    questions.push({
      id: "vat_reverse_charge",
      question: "Gäller omvänd byggmoms mot de hantverkare ni anlitar?",
      because: "Det ändrar hur fakturorna ser ut och när momsen ska redovisas.",
    });
  }

  return questions;
}

/**
 * Flaggor när kalkylens momsantagande inte går ihop med svaren.
 *
 * Ingen flagga säger att avdraget är fel — bara att kombinationen behöver
 * kontrolleras innan någon räknar med pengarna.
 */
export function vatRiskFlags(scenario: ScenarioInputs, type: ScenarioType): RiskFlag[] {
  if (!isCompanyScenario(type)) return [];

  const flags: RiskFlag[] = [];
  const vat = scenario.vat;
  const deducting = vat.vatTreatment !== "none" && vat.vatDeductiblePercent > 0;

  if (deducting && RESIDENTIAL_USES.has(vat.intendedUse)) {
    flags.push({
      id: "vat_deduction_on_residential_use",
      severity: "high",
      text: "Ni räknar med momsavdrag samtidigt som huset ska säljas eller hyras ut som bostad. Det går sällan ihop — stäm av innan ni litar på siffran.",
    });
  }

  if (deducting && vat.intendedUse === "rent_commercial" && vat.voluntaryTaxLiability !== "yes") {
    flags.push({
      id: "vat_deduction_without_voluntary_liability",
      severity: "high",
      text: "Momsavdraget bygger på uthyrning till lokal, men fastigheten är inte angiven som frivilligt skattskyldig. Utan det finns normalt ingen avdragsrätt.",
    });
  }

  if (vat.intendedUse === "rent_short_term_hotel_like") {
    // Till skillnad från vanlig bostadsuthyrning kan hotellikt korttidsboende
    // vara momspliktigt, vilket öppnar för avdrag — men gränsen är oskarp,
    // så varken ett avdrag eller ett uteblivet avdrag ska stå obekräftat.
    flags.push({
      id: deducting
        ? "vat_hotel_classification_unconfirmed"
        : "vat_hotel_deduction_possibly_unused",
      severity: deducting ? "medium" : "low",
      text: deducting
        ? "Momsavdraget bygger på att uthyrningen räknas som hotellverksamhet, inte vanlig bostadsuthyrning. Den gränsen är oskarp — stäm av klassificeringen innan ni litar på avdraget."
        : "Uthyrningen är angiven som hotellik men kalkylen räknar utan momsavdrag. Räknas den som momspliktig hotellverksamhet kan renoveringen bli billigare än vad som visas.",
    });
  }

  if (vat.buildWorkBy === "own_staff") {
    flags.push({
      id: "vat_own_staff_self_supply",
      severity: "medium",
      text: "Bolaget bygger med egen personal. Då kan moms behöva redovisas på arbetet även om ingen fakturerar er — fråga rådgivaren om uttagsbeskattning.",
    });
  }

  if (!deducting && vat.intendedUse === "rent_commercial") {
    flags.push({
      id: "vat_possible_deduction_unused",
      severity: "low",
      text: "Huset ska hyras ut som lokal men kalkylen räknar utan momsavdrag. Blir fastigheten frivilligt skattskyldig kan renoveringen bli billigare än vad som visas.",
    });
  }

  return flags;
}
