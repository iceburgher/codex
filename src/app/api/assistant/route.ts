import { NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { calculateAllScenarios } from "@/calculations/engine";
import { RUNNING_COST_LABELS } from "@/calculations/operatingCosts";
import { getAnthropic, ASSISTANT_MODEL } from "@/lib/anthropic";
import { formatMoney, formatPercent } from "@/lib/format";
import { migrateProject } from "@/lib/migrations";
import type { AiChatMessage, PropertyProject, ScenarioResult } from "@/types";

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
    "Föreslå en ändring av projektets antaganden. Skicka bara de fält som faktiskt ska ändras — allt annat lämnas orört. Fält som inte redan finns i projektet ignoreras.",
  input_schema: {
    type: "object",
    properties: {
      inputs: {
        type: "object",
        description: "Grunduppgifter om affären.",
        properties: {
          purchasePrice: { type: "number" },
          expectedSalePrice: { type: "number" },
          priorYearTaxAssessmentValue: { type: "number" },
          existingMortgageDeeds: { type: "number" },
          holdingPeriodMonths: { type: "number" },
        },
      },
      rental: {
        type: "object",
        description: "Uthyrning under innehavstiden.",
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
        description: "Löpande driftkostnader per år.",
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
    },
  };
}

const SYSTEM_PROMPT = `Du är inbyggd i en svensk kalkylator för fastighetsprojekt och pratar direkt med den som äger projektet.
Du ser projektets aktuella siffror nedan — de är redan uträknade, hitta aldrig på egna belopp eller skatteregler.
Skriv kort, rakt och utan finansjargong. Inga rubriker eller punktlistor.

Dela alltid svaret i korta stycken (2-4 meningar vardera) med en tom rad mellan varje stycke — aldrig en enda lång sammanhängande text. Ett kort svar på en enkel fråga kan vara ett enda stycke, men så fort svaret täcker flera saker (t.ex. läget just nu, en rekommendation, och vad som är osäkert) ska det vara ett eget stycke per sak.

Två typer av frågor:
1. Frågor om vad siffrorna betyder eller vilket alternativ som ser bäst ut — svara direkt utifrån det som skickas med. Saknas underlag (t.ex. försäljningspris), säg det i stället för att gissa.
2. Förslag på en ändring ("tänk om vi hyr ut för...", "höj lånet till...", "sätt räntan till...") — räkna ut vad det betyder i projektets fält och anropa verktyget ${UPDATE_TOOL_NAME} med bara de fält som ska ändras. Ange alltid belopp i grundenheten fältet använder (t.ex. kr per VECKA för hyra, inte per månad — räkna om själv och nämn omräkningen i svaret så det går att rätta om den blir fel). Skriv alltid en kort mening om vad du ändrade och varför, även när du anropar verktyget.

Var tydlig när en fråga egentligen kräver en skatterådgivare — gissa aldrig på skatteklassificeringar.`;

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
    const message = await client.messages.create({
      model: ASSISTANT_MODEL,
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      tools: [UPDATE_TOOL],
      messages,
    });

    const textBlocks = message.content.filter(
      (block): block is Anthropic.TextBlock => block.type === "text",
    );
    const toolUse = message.content.find(
      (block): block is Anthropic.ToolUseBlock =>
        block.type === "tool_use" && block.name === UPDATE_TOOL_NAME,
    );

    const reply = textBlocks
      .map((b) => b.text)
      .join("\n")
      .trim();

    return NextResponse.json({
      reply: reply || (toolUse ? "Uppdaterat." : "Fick inget svar från AI-tjänsten."),
      patch: toolUse ? toolUse.input : null,
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
