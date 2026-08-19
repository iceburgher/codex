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
  | "taxAssessmentValue"
  | "existingMortgageDeeds"
  | "propertyFeeAnnual"
  | "heatingAnnual"
  | "electricityAnnual"
  | "waterSewerAnnual"
  | "wasteAnnual"
  | "operatingCostAnnual";

export interface ProspectField<T> {
  value: T;
  /** Textutdraget värdet lästes ur, så att användaren kan kontrollera det. */
  evidence: string;
}

export type ProspectExtract = Partial<{
  address: ProspectField<string>;
  municipality: ProspectField<string>;
  propertyDesignation: ProspectField<string>;
  purchasePrice: ProspectField<number>;
  livingAreaSqm: ProspectField<number>;
  ancillaryAreaSqm: ProspectField<number>;
  plotAreaSqm: ProspectField<number>;
  constructionYear: ProspectField<number>;
  taxAssessmentValue: ProspectField<number>;
  existingMortgageDeeds: ProspectField<number>;
  propertyFeeAnnual: ProspectField<number>;
  heatingAnnual: ProspectField<number>;
  electricityAnnual: ProspectField<number>;
  waterSewerAnnual: ProspectField<number>;
  wasteAnnual: ProspectField<number>;
  operatingCostAnnual: ProspectField<number>;
}>;

export const PROSPECT_FIELD_LABELS: Record<ProspectFieldKey, string> = {
  address: "Adress",
  municipality: "Kommun",
  propertyDesignation: "Fastighetsbeteckning",
  purchasePrice: "Utgångspris",
  livingAreaSqm: "Boarea",
  ancillaryAreaSqm: "Biarea",
  plotAreaSqm: "Tomtarea",
  constructionYear: "Byggår",
  taxAssessmentValue: "Taxeringsvärde",
  existingMortgageDeeds: "Befintliga pantbrev",
  propertyFeeAnnual: "Fastighetsavgift per år",
  heatingAnnual: "Uppvärmning per år",
  electricityAnnual: "El per år",
  waterSewerAnnual: "Vatten och avlopp per år",
  wasteAnnual: "Sophämtning per år",
  operatingCostAnnual: "Driftkostnad per år",
};

/** Poster som hör till driften, i den ordning de brukar stå i ett prospekt. */
export const OPERATING_COST_FIELDS: ProspectFieldKey[] = [
  "heatingAnnual",
  "electricityAnnual",
  "waterSewerAnnual",
  "wasteAnnual",
  "operatingCostAnnual",
  "propertyFeeAnnual",
];

/**
 * Blankstegsvarianterna annonser använder som tusentalsavgränsare. Tecknen
 * hålls separat från hakparenteserna så att de går att återanvända både som
 * egen teckenklass och inuti en större.
 */
const SPACE_CHARS = "\\s\\u00a0\\u202f\\u2009.";
const SPACE = `[${SPACE_CHARS}]`;
const MONEY = `([\\d${SPACE_CHARS}]{4,})${SPACE}*(?:kr|SEK|:-)`;
const AREA = `([\\d${SPACE_CHARS},]+)${SPACE}*(?:m²|m2|kvm)`;

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
    return { value, evidence: tidy(match[0]) };
  }
  return undefined;
}

function findText(text: string, patterns: RegExp[]): ProspectField<string> | undefined {
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (!match) continue;
    const value = tidy(match[1]);
    if (value.length === 0) continue;
    return { value, evidence: tidy(match[0]) };
  }
  return undefined;
}

function tidy(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/**
 * Klipper ut avsnittet efter en rubrik.
 *
 * Etiketter återkommer i olika betydelser på samma sida — "Uppvärmning" är
 * "Elpanna" under byggnadsinformation men ett belopp under driftskostnader.
 * Utan avgränsning skulle fel förekomst vinna.
 */
function sectionAfter(text: string, heading: RegExp, length = 500): string {
  const match = heading.exec(text);
  if (!match) return "";
  const start = match.index + match[0].length;
  return text.slice(start, start + length);
}

export function parseProspectText(input: string): ProspectExtract {
  const text = input.replace(/\r/g, "").replace(/[ \t]+/g, " ");
  const drift = sectionAfter(text, /drifts?kostnad(?:er)?(?:\s*per\s*år)?/i, 400);

  const itemised: ProspectExtract = {
    heatingAnnual: findNumber(drift, [new RegExp(`uppvärmning${SPACE}*${MONEY}`, "i")], {
      min: 100,
    }),
    electricityAnnual: findNumber(drift, [new RegExp(`\\bel${SPACE}*${MONEY}`, "i")], { min: 100 }),
    waterSewerAnnual: findNumber(
      drift,
      [new RegExp(`vatten(?:${SPACE}*(?:och|&|\\/)${SPACE}*avlopp)?${SPACE}*${MONEY}`, "i")],
      { min: 100 },
    ),
    wasteAnnual: findNumber(
      drift,
      [new RegExp(`(?:renhållning|sophämtning|avfall)${SPACE}*${MONEY}`, "i")],
      { min: 100 },
    ),
  };

  const hasItemised = Object.values(itemised).some((v) => v !== undefined);

  /*
   * Summan är posterna adderade. Fanns posterna utelämnas den, annars skulle
   * driftkostnaden räknas två gånger när båda skrivs in i projektet.
   */
  const total = hasItemised
    ? undefined
    : findNumber(
        text,
        [
          new RegExp(`drifts?kostnad(?:er)?[^\\n]{0,60}?${MONEY}`, "i"),
          new RegExp(`summa${SPACE}*${MONEY}`, "i"),
        ],
        { min: 500 },
      );

  return {
    ...itemised,
    operatingCostAnnual: total,

    purchasePrice: findNumber(
      text,
      [
        new RegExp(
          `(?:utgångspris|utropspris|begärt${SPACE}*pris|pris(?:idé)?)${SPACE}*:?${SPACE}*${MONEY}`,
          "i",
        ),
        // Hemnet renderar fakta i webbläsaren; priset finns i sidans JSON-LD.
        /"price"\s*:\s*"?(\d{5,})"?/i,
      ],
      { min: 10_000 },
    ),

    taxAssessmentValue: findNumber(text, [new RegExp(`taxeringsvärde[^\\n]{0,40}?${MONEY}`, "i")], {
      min: 1_000,
    }),

    /** "Totalt 5 st pantbrev om 897 200 kr" — antalet är inte beloppet. */
    existingMortgageDeeds: findNumber(
      text,
      [
        new RegExp(`pantbrev[^.\\n]{0,40}?om${SPACE}*${MONEY}`, "i"),
        new RegExp(`pantbrev[^.\\n]{0,40}?${MONEY}`, "i"),
        new RegExp(`${MONEY}[^.\\n]{0,20}?i${SPACE}*pantbrev`, "i"),
      ],
      { min: 1_000 },
    ),

    propertyFeeAnnual: findNumber(
      text,
      [new RegExp(`fastighetsavgift(?:${SPACE}*på)?${SPACE}*${MONEY}`, "i")],
      { min: 100 },
    ),

    livingAreaSqm: findNumber(
      text,
      [
        new RegExp(`(?:boarea|boyta|bostadsyta)${SPACE}*:?${SPACE}*${AREA}`, "i"),
        // "Bo & biarea 154 + 32 m²" — första talet är boarean.
        new RegExp(`bo${SPACE}*(?:&|och)${SPACE}*biarea${SPACE}*:?${SPACE}*(\\d+)${SPACE}*\\+`, "i"),
        new RegExp(`${AREA}${SPACE}*boarea`, "i"),
      ],
      { min: 5, max: 10_000 },
    ),

    ancillaryAreaSqm: findNumber(
      text,
      [
        new RegExp(`(?:biarea|biyta)${SPACE}*:?${SPACE}*${AREA}`, "i"),
        new RegExp(`bo${SPACE}*(?:&|och)${SPACE}*biarea[^\\n]{0,20}?\\+${SPACE}*${AREA}`, "i"),
      ],
      { min: 1, max: 10_000 },
    ),

    plotAreaSqm: findNumber(
      text,
      [new RegExp(`(?:tomtarea|tomtstorlek|tomtyta|tomt)${SPACE}*:?${SPACE}*${AREA}`, "i")],
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
      // Lat upprepning: beteckningen slutar vid sitt första nummer, annars
      // skulle nästa etikett på raden dras med in.
      /(?:fastighetsbeteckning|fast\.?\s*beteckning)\s*:?\s*([A-ZÅÄÖ][\wÅÄÖåäö-]*(?:\s+[\wÅÄÖåäö-]+){0,3}?\s+\d+(?::\d+)?)\b/i,
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

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  sup2: "²",
  sup3: "³",
  aring: "å",
  Aring: "Å",
  auml: "ä",
  Auml: "Ä",
  ouml: "ö",
  Ouml: "Ö",
  eacute: "é",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  deg: "°",
};

function decodeEntities(text: string): string {
  return text
    .replace(/&([a-z][a-z0-9]*);/gi, (whole, name: string) => NAMED_ENTITIES[name] ?? whole)
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}
