/**
 * Läser ut objektuppgifter ur text från ett prospekt eller en annonssida.
 *
 * Rena funktioner utan nätverk eller filsystem, så att tolkningen går att
 * testa. Inget fält gissas: hittas inte ett värde lämnas det tomt, och varje
 * träff bär med sig textutdraget den kom ifrån så att användaren kan granska
 * innan något skrivs in i projektet.
 */

export type ProspectFieldKey =
  | "address"
  | "municipality"
  | "propertyDesignation"
  | "purchasePrice"
  | "livingAreaSqm"
  | "ancillaryAreaSqm"
  | "plotAreaSqm"
  | "constructionYear"
  | "operatingCostAnnual"
  | "taxAssessmentValue";

export interface ProspectField<T> {
  value: T;
  /** Textutdraget värdet lästes ur, så att användaren kan kontrollera det. */
  evidence: string;
}

export interface ProspectExtract {
  address?: ProspectField<string>;
  municipality?: ProspectField<string>;
  propertyDesignation?: ProspectField<string>;
  purchasePrice?: ProspectField<number>;
  livingAreaSqm?: ProspectField<number>;
  ancillaryAreaSqm?: ProspectField<number>;
  plotAreaSqm?: ProspectField<number>;
  constructionYear?: ProspectField<number>;
  operatingCostAnnual?: ProspectField<number>;
  taxAssessmentValue?: ProspectField<number>;
}

export const PROSPECT_FIELD_LABELS: Record<ProspectFieldKey, string> = {
  address: "Adress",
  municipality: "Kommun",
  propertyDesignation: "Fastighetsbeteckning",
  purchasePrice: "Utgångspris",
  livingAreaSqm: "Boarea",
  ancillaryAreaSqm: "Biarea",
  plotAreaSqm: "Tomtarea",
  constructionYear: "Byggår",
  operatingCostAnnual: "Driftkostnad per år",
  taxAssessmentValue: "Taxeringsvärde",
};

/**
 * Blankstegsvarianterna annonser använder som tusentalsavgränsare. Tecknen
 * hålls separat från hakparenteserna så att de går att återanvända både som
 * egen teckenklass och inuti en större.
 */
const SPACE_CHARS = "\\s\\u00a0\\u202f\\u2009.";
const SPACE = `[${SPACE_CHARS}]`;

/** "3 600 000 kr" → 3600000. Returnerar null när talet inte går att tyda. */
export function parseSwedishNumber(raw: string): number | null {
  const cleaned = raw
    .replace(/[\s   ]/g, "")
    .replace(/\.(?=\d{3}\b)/g, "")
    .replace(",", ".");
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function findNumber(
  text: string,
  patterns: RegExp[],
  { max, min }: { max?: number; min?: number } = {},
): ProspectField<number> | undefined {
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (!match) continue;
    const value = parseSwedishNumber(match[1]);
    if (value === null) continue;
    if (max !== undefined && value > max) continue;
    if (min !== undefined && value < min) continue;
    return { value, evidence: match[0].trim().replace(/\s+/g, " ") };
  }
  return undefined;
}

function findText(text: string, patterns: RegExp[]): ProspectField<string> | undefined {
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (!match) continue;
    const value = match[1].trim().replace(/\s+/g, " ");
    if (value.length === 0) continue;
    return { value, evidence: match[0].trim().replace(/\s+/g, " ") };
  }
  return undefined;
}

export function parseProspectText(input: string): ProspectExtract {
  // Radbrytningar mitt i en etikett är vanligt i PDF-text.
  const text = input.replace(/\r/g, "").replace(/[ \t]+/g, " ");

  const money = `([\\d${SPACE_CHARS}]{4,})${SPACE}*(?:kr|SEK|:-)`;
  const area = `([\\d${SPACE_CHARS},]+)${SPACE}*(?:m²|m2|kvm)`;

  return {
    purchasePrice: findNumber(
      text,
      [
        new RegExp(`(?:utgångspris|utropspris|begärt\\s*pris|pris(?:idé)?)\\s*:?\\s*${money}`, "i"),
        new RegExp(`${money}\\s*(?:\\/|\\s)*(?:utgångspris)`, "i"),
      ],
      { min: 10_000 },
    ),

    taxAssessmentValue: findNumber(
      text,
      [new RegExp(`taxeringsvärde[^\\n]{0,40}?${money}`, "i")],
      { min: 1_000 },
    ),

    operatingCostAnnual: findNumber(
      text,
      [
        new RegExp(`driftkostnad(?:er)?[^\\n]{0,40}?${money}\\s*(?:\\/|per)?\\s*(?:år)?`, "i"),
        new RegExp(`driftskostnad(?:er)?[^\\n]{0,40}?${money}`, "i"),
      ],
      { min: 100 },
    ),

    livingAreaSqm: findNumber(
      text,
      [
        new RegExp(`(?:boarea|boyta|bostadsyta)\\s*:?\\s*${area}`, "i"),
        new RegExp(`${area}\\s*boarea`, "i"),
      ],
      { min: 5, max: 10_000 },
    ),

    ancillaryAreaSqm: findNumber(text, [new RegExp(`(?:biarea|biyta)\\s*:?\\s*${area}`, "i")], {
      min: 1,
      max: 10_000,
    }),

    plotAreaSqm: findNumber(
      text,
      [new RegExp(`(?:tomtarea|tomtstorlek|tomtyta|tomt)\\s*:?\\s*${area}`, "i")],
      { min: 10, max: 10_000_000 },
    ),

    constructionYear: findNumber(
      text,
      [/(?:byggår|byggnadsår|uppförd(?:es)?)\s*:?\s*(?:år\s*)?(\d{4})/i],
      { min: 1200, max: new Date().getFullYear() + 5 },
    ),

    municipality: findText(text, [
      // "Båstads kommun" är den vanligare formen och prövas först, så att
      // etikettformen inte råkar plocka nästa rubrik på raden under.
      /([A-ZÅÄÖ][\wÅÄÖåäö-]+\s+kommun)\b/,
      /kommun\s*:?[ \t]*([A-ZÅÄÖ][\wÅÄÖåäö-]+)/i,
    ]),

    propertyDesignation: findText(text, [
      /fastighetsbeteckning\s*:?\s*([A-ZÅÄÖ][\wÅÄÖåäö-]*(?:\s+[\wÅÄÖåäö-]+){0,3}\s+\d+[:\d]*)/i,
    ]),

    address: findText(text, [
      /adress\s*:?\s*([A-ZÅÄÖ][^\n,]{2,60}?\s+\d+[A-Za-z]?)\s*(?:,|\n|$)/i,
      // Rubrikraden i ett prospekt är ofta bara gatuadressen, indragen.
      /^[ \t]*([A-ZÅÄÖ][\wÅÄÖåäö-]*(?:gatan|vägen|gränd|torget|stigen|backen|allén)\s+\d+[A-Za-z]?)/im,
    ]),
  };
}

/** Antal fält som faktiskt lästes ut. */
export function countExtracted(extract: ProspectExtract): number {
  return Object.values(extract).filter((v) => v !== undefined).length;
}

/**
 * Plockar ut brödtext ur HTML. Script- och stilblock tas bort först, och
 * JSON-LD läggs till separat eftersom annonssidor ofta lägger pris och area
 * där i stället för i den synliga texten.
 */
export function htmlToText(html: string): string {
  const jsonLd: string[] = [];
  const scriptPattern =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptPattern.exec(html)) !== null) {
    jsonLd.push(match[1]);
  }

  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  return decodeEntities(`${body}\n${jsonLd.join("\n")}`);
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}
