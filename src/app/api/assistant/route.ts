import { NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { calculateAllScenarios } from "@/calculations/engine";
import { RUNNING_COST_LABELS } from "@/calculations/operatingCosts";
import { applyAssistantPatch } from "@/lib/assistantPatch";
import { getAnthropic, ASSISTANT_MODEL } from "@/lib/anthropic";
import { formatMoney, formatPercent } from "@/lib/format";
import { migrateProject } from "@/lib/migrations";
import { SCENARIO_LABELS } from "@/types";
import type { AiChatMessage, PropertyProject, ScenarioResult, ScenarioType } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_HISTORY = 20;

const UPDATE_TOOL_NAME = "uppdatera_antaganden";

/**
 * Formen speglar bara de vanligaste fälten — resten av projektets siffror
 * går fortfarande att ändra, eftersom servern accepterar varje nyckel som
 * redan finns i projektet, inte bara de som listas här. Schemat är till för
 * att visa modellen var i strukturen saker bor, inte en fullständig karta.
 */
const UPDATE_TOOL: Anthropic.Tool = {
  name: UPDATE_TOOL_NAME,
  description:
    "Föreslå en ändring av projektet — allt som går att skriva i, inte bara belopp: adress, kommun, fastighetsbeteckning, areor, anteckningar och projektnamn är lika giltiga fält som pris och lån. Skicka bara de fält som faktiskt ska ändras — allt annat lämnas orört. Fält som inte redan finns i projektet ignoreras.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Projektets namn." },
      notes: { type: "string", description: "Fria anteckningar om projektet." },
      facts: {
        type: "object",
        description: "Fakta om objektet — inte belopp, men lika mycket fält att ändra.",
        properties: {
          address: { type: "string" },
          municipality: { type: "string" },
          propertyDesignation: { type: "string", description: "Fastighetsbeteckning." },
          constructionYear: { type: "number" },
          livingAreaSqm: { type: "number", description: "Boarea." },
          ancillaryAreaSqm: { type: "number", description: "Biarea." },
          plotAreaSqm: { type: "number", description: "Tomtarea." },
          structureNotes: { type: "string" },
          siteNotes: { type: "string" },
          notes: { type: "string" },
        },
      },
      inputs: {
        type: "object",
        description: "Grunduppgifter om affären.",
        properties: {
          purchasePrice: { type: "number" },
          expectedSalePrice: { type: "number" },
          priorYearTaxAssessmentValue: { type: "number" },
          existingMortgageDeeds: { type: "number" },
          holdingPeriodMonths: { type: "number" },
          ownershipSharePerson1: { type: "number" },
          ownershipSharePerson2: { type: "number" },
        },
      },
      rental: {
        type: "object",
        description:
          "Uthyrning under innehavstiden. Uthyrningen kan bara ske EFTER att renoveringen är klar (renoveringen tar upp till 6 av innehavstidens månader, eller hela innehavstiden om den är kortare) — den ryms alltså inte parallellt med renoveringen.",
        properties: {
          enabled: { type: "boolean" },
          rentedWeeks: { type: "number", description: "Antal uthyrningsveckor totalt." },
          rentPerWeek: { type: "number", description: "Hyra i kr per vecka, inte per månad." },
          platformFeePercent: { type: "number" },
          cleaningPerStay: { type: "number" },
          numberOfStays: { type: "number" },
          extraUtilities: { type: "number" },
          extraWearAndTear: { type: "number" },
        },
      },
      renovation: {
        type: "object",
        description: "Renoveringsbudget, kronor per post.",
        properties: {
          laborGross: { type: "number" },
          materialsGross: { type: "number" },
          appliances: { type: "number" },
          fixedInterior: { type: "number" },
          looseInterior: { type: "number" },
          styling: { type: "number" },
          landscaping: { type: "number" },
          other: { type: "number" },
          contingencyPercent: { type: "number", description: "Andel, t.ex. 0.15 för 15 %." },
        },
      },
      operatingCosts: {
        type: "object",
        description:
          "Löpande driftkostnader per år, en post i taget. Anger användaren en total driftkostnad utan att dela upp den, sätt hela beloppet på otherAnnual (Övrigt) i stället för att gissa på fördelningen mellan el, uppvärmning, vatten osv.",
        properties: Object.fromEntries(
          Object.keys(RUNNING_COST_LABELS).map((key) => [key, { type: "number" }]),
        ),
      },
      sale: {
        type: "object",
        description: "Kostnader vid försäljning.",
        properties: {
          brokerFeePercent: { type: "number", description: "Andel, t.ex. 0.03 för 3 %." },
          brokerFeeFixed: { type: "number" },
        },
      },
      optimizationTarget: {
        type: "string",
        enum: [
          "max_private_cash",
          "max_company_cash",
          "max_family_net_worth",
          "max_equity_roi",
          "min_peak_cash_required",
          "min_tax",
        ],
      },
      scenarios: {
        type: "object",
        description:
          "Nycklar: PRIVATE_EQUITY (privat utan lån), PRIVATE_DEBT (privat med lån), EXISTING_COMPANY (bolaget äger).",
        properties: {
          PRIVATE_DEBT: scenarioPatchSchema(),
          PRIVATE_EQUITY: scenarioPatchSchema(),
          EXISTING_COMPANY: scenarioPatchSchema(),
        },
      },
    },
  },
};

function scenarioPatchSchema(): Anthropic.Tool.InputSchema {
  return {
    type: "object",
    properties: {
      privateLoans: {
        type: "object",
        properties: {
          mortgageAmount: { type: "number" },
          mortgageInterestRate: { type: "number", description: "T.ex. 0.045 för 4,5 %." },
          unsecuredLoanAmount: { type: "number" },
          unsecuredInterestRate: { type: "number" },
        },
      },
      companyFunding: {
        type: "object",
        properties: {
          companyCashInvested: { type: "number" },
          externalBusinessLoan: { type: "number" },
          businessInterestRate: { type: "number" },
        },
      },
      vat: {
        type: "object",
        properties: {
          vatTreatment: { type: "string", enum: ["none", "partial", "full"] },
          vatDeductiblePercent: { type: "number" },
          intendedUse: { type: "string" },
        },
      },
      dividend: {
        type: "object",
        properties: {
          dividendTaxAboveAllowance: { type: "number" },
        },
      },
      rot: {
        type: "object",
        description: "ROT-avdrag, bara relevant privat.",
        properties: {
          enabled: { type: "boolean" },
          eligibleLaborCostGross: { type: "number" },
        },
      },
      privateUseLevel: {
        type: "string",
        enum: ["none", "occasional", "frequent", "full_disposition"],
        description: "Hur mycket ägarna själva använder huset.",
      },
      flipIntent: {
        type: "boolean",
        description: "Om syftet uttryckligen är att renovera och sälja.",
      },
      classificationConfirmedByAdvisor: {
        type: "boolean",
        description: "Om en rådgivare har bekräftat den skattemässiga klassificeringen.",
      },
    },
  };
}

const SYSTEM_PROMPT = `Du är inbyggd i en svensk kalkylator för fastighetsprojekt och pratar direkt med den som äger projektet.
Du ser projektets aktuella siffror nedan — de är redan uträknade, hitta aldrig på egna belopp eller skatteregler.
Skriv kort, rakt och utan finansjargong. Inga rubriker eller punktlistor.

Dela alltid svaret i korta stycken (2-4 meningar vardera) med en tom rad mellan varje stycke — aldrig en enda lång sammanhängande text. Ett kort svar på en enkel fråga kan vara ett enda stycke, men så fort svaret täcker flera saker (t.ex. läget just nu, en rekommendation, och vad som är osäkert) ska det vara ett eget stycke per sak.

Tre typer av meddelanden:
1. Frågor om vad siffrorna betyder eller vilket alternativ som ser bäst ut — svara direkt utifrån det som skickas med. Saknas underlag (t.ex. försäljningspris), säg det i stället för att gissa.
2. Ett konkret, fullständigt förslag på en ändring ("tänk om vi hyr ut för 25 000 kr i månaden i ett år", "höj lånet till 3,2 miljoner") — räkna ut vad det betyder i projektets fält och anropa verktyget ${UPDATE_TOOL_NAME} med bara de fält som ska ändras. Ange alltid belopp i grundenheten fältet använder (t.ex. kr per VECKA för hyra, inte per månad — räkna om själv, till exempel 25 000 kr/månad i tolv månader blir 52 veckor à ca 5 769 kr). Anropa aldrig verktyget utan att också skriva text — texten ska säga vad du ändrar och varför, aldrig bara bekräfta i efterhand.
3. Ett vagt eller ofullständigt förslag där du inte kan avgöra konkreta tal (t.ex. saknar belopp, eller är tvetydigt), eller ett förslag som verkar strida mot något som redan är ifyllt (t.ex. en uthyrningsperiod längre än projektets innehavstid) — anropa INTE verktyget då. Ställ i stället en kort, konkret fråga om exakt vad som saknas eller är oklart, i stället för att gissa dig fram.

Var tydlig när en fråga egentligen kräver en skatterådgivare — gissa aldrig på skatteklassificeringar.`;

const CONSEQUENCE_SYSTEM_PROMPT = `Du föreslog nyss en ändring av projektets antaganden. Ett verktygssvar visar om den gick att tillämpa, och om den gjorde det, de omräknade siffrorna efteråt.
Förklara kort vad ändringen faktiskt betyder: vilka av de jämförda alternativen som påverkas och hur, jämfört med innan. Använd bara talen i verktygssvaret — hitta aldrig på egna. Skriv i korta stycken (2-4 meningar) med tom rad mellan om det är mer än en sak att säga.
Om verktygssvaret säger att ändringen inte gick att tillämpa: förklara det tydligt och fråga vad som menades i stället för att låtsas att något hände.
Svara aldrig bara "Uppdaterat" eller liknande utan att förklara konsekvensen.`;

const FIELD_LABELS: Record<string, string> = {
  name: "projektnamn",
  notes: "anteckningar",
  "facts.address": "adress",
  "facts.municipality": "kommun",
  "facts.propertyDesignation": "fastighetsbeteckning",
  "facts.constructionYear": "byggår",
  "facts.livingAreaSqm": "boarea",
  "facts.ancillaryAreaSqm": "biarea",
  "facts.plotAreaSqm": "tomtarea",
  "facts.structureNotes": "anteckningar om byggnaden",
  "facts.siteNotes": "anteckningar om tomten",
  "facts.notes": "övriga anteckningar om objektet",
  "inputs.purchasePrice": "köpeskilling",
  "inputs.expectedSalePrice": "förväntat försäljningspris",
  "inputs.priorYearTaxAssessmentValue": "taxeringsvärde",
  "inputs.existingMortgageDeeds": "befintliga pantbrev",
  "inputs.holdingPeriodMonths": "innehavstid",
  "inputs.ownershipSharePerson1": "ägarandel, person 1",
  "inputs.ownershipSharePerson2": "ägarandel, person 2",
  "rental.enabled": "uthyrning påslagen",
  "rental.rentedWeeks": "antal uthyrningsveckor",
  "rental.rentPerWeek": "hyra per vecka",
  "rental.platformFeePercent": "plattformsavgift vid uthyrning",
  "rental.cleaningPerStay": "städkostnad per uthyrning",
  "rental.numberOfStays": "antal uthyrningstillfällen",
  "rental.extraUtilities": "extra driftkostnader vid uthyrning",
  "rental.extraWearAndTear": "extra slitage vid uthyrning",
  "sale.brokerFeePercent": "mäklararvode, andel",
  "sale.brokerFeeFixed": "mäklararvode, fast belopp",
  "optimizationTarget": "vad kalkylen optimeras mot",
  "renovation.laborGross": "renovering: arbete",
  "renovation.materialsGross": "renovering: material",
  "renovation.appliances": "renovering: vitvaror",
  "renovation.fixedInterior": "renovering: fast inredning",
  "renovation.looseInterior": "renovering: lös inredning",
  "renovation.styling": "renovering: styling",
  "renovation.landscaping": "renovering: trädgård",
  "renovation.other": "renovering: övrigt",
  "renovation.contingencyPercent": "renovering: oförutsett",
};
for (const [key, label] of Object.entries(RUNNING_COST_LABELS)) {
  FIELD_LABELS[`operatingCosts.${key}`] = `driftkostnad: ${label.toLowerCase()}`;
}

const SCENARIO_SUBFIELD_LABELS: Record<string, string> = {
  "privateLoans.mortgageAmount": "lånebelopp (bolån)",
  "privateLoans.mortgageInterestRate": "ränta (bolån)",
  "privateLoans.unsecuredLoanAmount": "lånebelopp (blancolån)",
  "privateLoans.unsecuredInterestRate": "ränta (blancolån)",
  "companyFunding.companyCashInvested": "eget kapital från bolaget",
  "companyFunding.externalBusinessLoan": "bolagets lån",
  "companyFunding.businessInterestRate": "ränta på bolagets lån",
  "vat.vatTreatment": "momshantering",
  "vat.vatDeductiblePercent": "andel avdragsgill moms",
  "vat.intendedUse": "avsedd användning (moms)",
  "dividend.dividendTaxAboveAllowance": "skatt på utdelning över gränsbeloppet",
  "rot.enabled": "ROT-avdrag påslaget",
  "rot.eligibleLaborCostGross": "arbetskostnad som ROT räknas på",
  privateUseLevel: "ägarnas egen användning",
  flipIntent: "syfte: renovera och sälja",
  classificationConfirmedByAdvisor: "skattemässig klassificering bekräftad av rådgivare",
};

/** Översätter en punktad fältväg (t.ex. "rental.rentPerWeek") till vanlig svenska. */
function labelFor(path: string): string {
  if (FIELD_LABELS[path]) return FIELD_LABELS[path];
  const scenarioMatch = /^scenarios\.([A-Z_]+)\.(.+)$/.exec(path);
  if (scenarioMatch) {
    const [, type, rest] = scenarioMatch;
    const scenarioLabel = SCENARIO_LABELS[type as ScenarioType] ?? type;
    const fieldLabel = SCENARIO_SUBFIELD_LABELS[rest] ?? rest;
    return `${fieldLabel} (${scenarioLabel})`;
  }
  return path;
}

/** En deterministisk bekräftelse — bygger aldrig på vad modellen själv säger att den gjorde. */
function describeChange(changed: string[]): string {
  if (changed.length === 0) {
    return "Inget av det jag föreslog gick att koppla till ett fält i projektet, så inget uppdaterades.";
  }
  return `Uppdaterat: ${changed.map(labelFor).join(", ")}.`;
}

function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

export async function POST(request: Request) {
  const client = getAnthropic();
  if (!client) {
    return NextResponse.json(
      { error: "Chatten är inte påslagen för det här projektet ännu." },
      { status: 503 },
    );
  }

  let project: PropertyProject;
  let history: AiChatMessage[];
  try {
    const body = (await request.json()) as { project?: unknown; history?: unknown };
    project = migrateProject((body.project ?? {}) as Record<string, unknown>);
    history = Array.isArray(body.history) ? (body.history as AiChatMessage[]) : [];
  } catch {
    return NextResponse.json({ error: "Kunde inte läsa förfrågan." }, { status: 400 });
  }

  if (history.length === 0 || history[history.length - 1]?.role !== "user") {
    return NextResponse.json({ error: "Inget meddelande att svara på." }, { status: 400 });
  }

  const results = project.compareScenarios.length > 0 ? calculateAllScenarios(project) : [];
  const context = buildContext(project, results);

  const messages: Anthropic.MessageParam[] = history.slice(-MAX_HISTORY).map((m) => ({
    role: m.role,
    content: m.text,
  }));
  messages[messages.length - 1] = {
    role: "user",
    content: `${context}\n\nMEDDELANDE FRÅN ANVÄNDAREN\n${history[history.length - 1].text}`,
  };

  try {
    const firstPass = await client.messages.create({
      model: ASSISTANT_MODEL,
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      tools: [UPDATE_TOOL],
      messages,
    });

    const toolUse = firstPass.content.find(
      (block): block is Anthropic.ToolUseBlock =>
        block.type === "tool_use" && block.name === UPDATE_TOOL_NAME,
    );

    if (!toolUse) {
      const reply = textOf(firstPass);
      return NextResponse.json({
        reply: reply || "Fick inget svar från AI-tjänsten.",
        patch: null,
      });
    }

    // Simulera ändringen mot en kopia av projektet i stället för att låta
    // modellen gissa på konsekvenserna — nästa anrop får förklara utifrån
    // faktiskt omräknade tal.
    const patched: PropertyProject = JSON.parse(JSON.stringify(project));
    const { changed } = applyAssistantPatch(patched, toolUse.input);
    const patchedResults =
      patched.compareScenarios.length > 0 ? calculateAllScenarios(patched) : [];
    const statusLine = describeChange(changed);

    const toolResultContent =
      changed.length > 0
        ? `Ändringen tillämpades. ${statusLine}\n\nNya siffror efter ändringen:\n\n${buildContext(patched, patchedResults)}`
        : `${statusLine} Fälten i förslaget matchade inget i projektets nuvarande struktur.`;

    const secondPass = await client.messages.create({
      model: ASSISTANT_MODEL,
      max_tokens: 500,
      system: CONSEQUENCE_SYSTEM_PROMPT,
      messages: [
        ...messages,
        { role: "assistant", content: firstPass.content as unknown as Anthropic.MessageParam["content"] },
        {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: toolUse.id,
              content: toolResultContent,
            },
          ],
        },
      ],
    });

    const explanation = textOf(secondPass);
    const reply = [statusLine, explanation].filter(Boolean).join("\n\n");

    return NextResponse.json({
      reply: reply || statusLine,
      patch: toolUse.input,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Okänt fel";
    return NextResponse.json(
      { error: `AI-tjänsten svarade inte som väntat: ${message}` },
      { status: 502 },
    );
  }
}

function buildContext(project: PropertyProject, results: ScenarioResult[]): string {
  const lines: string[] = [];

  lines.push("PROJEKTETS NUVARANDE SIFFROR");
  lines.push(`Adress: ${project.facts.address ?? "okänd"}`);
  lines.push(`Köpeskilling: ${formatMoney(project.inputs.purchasePrice)}`);
  lines.push(
    `Förväntat försäljningspris: ${
      project.inputs.expectedSalePrice === null
        ? "inte ifyllt"
        : formatMoney(project.inputs.expectedSalePrice)
    }`,
  );
  lines.push(`Innehavstid: ${project.inputs.holdingPeriodMonths} månader`);

  if (project.rental.enabled) {
    lines.push(
      `Uthyrning: ${project.rental.rentedWeeks} veckor à ${formatMoney(project.rental.rentPerWeek)} per vecka`,
    );
  }

  lines.push("");
  lines.push("ALTERNATIV SOM JÄMFÖRS");
  for (const r of results) {
    const isCompany = r.corporateTax !== null;
    lines.push("");
    lines.push(`## ${r.label} (scenario-nyckel: ${r.scenario})`);
    if (r.salePriceMissing) {
      lines.push("Går inte att räkna klart — försäljningspris saknas.");
      continue;
    }
    lines.push(`Vinst efter skatt (obelånat projektresultat): ${formatMoney(r.profitAfterTax)}`);
    if (isCompany) {
      lines.push(`Kvar i bolaget efter bolagsskatt: ${formatMoney(r.netRetainedInCompany)}`);
    } else {
      lines.push(`Kvar till ägaren privat: ${formatMoney(r.netAvailablePrivately)}`);
    }
    lines.push(`Avkastning på egna pengar: ${formatPercent(r.roi.equityROI)}`);
    lines.push(`Pengar som måste finnas tillgängliga: ${formatMoney(r.cashFlow.peakCashRequirement)}`);
    if (r.rental.grossRentalIncome > 0) {
      lines.push(`Hyresintäkter: ${formatMoney(r.rental.grossRentalIncome)}`);
    }
    if (r.riskFlags.length > 0) {
      lines.push(`Riskflaggor: ${r.riskFlags.map((f) => f.text).join(" ")}`);
    }
  }

  return lines.join("\n");
}
