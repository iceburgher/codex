import { NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { calculateAllScenarios } from "@/calculations/engine";
import { getAnthropic, SUMMARY_MODEL } from "@/lib/anthropic";
import { formatMoney, formatPercent } from "@/lib/format";
import { migrateProject } from "@/lib/migrations";
import type { PropertyProject, ScenarioResult } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `Du sammanfattar en kalkyl för ett svenskt fastighetsprojekt åt en privatperson.
Du får bara använda siffrorna som skickas med — hitta aldrig på egna belopp, procentsatser eller skatteregler.
Skriv på enkel, rak svenska utan finansjargong. Använd inte rubriker, punktlistor eller markdown — löpande text i korta stycken.
Svara i tre delar, i den ordningen:
1. Ett kort läge (2-3 meningar): vad kalkylen visar just nu.
2. En rekommendation (2-4 meningar): vilket alternativ siffrorna pekar mot och varför — men bara om underlaget faktiskt räcker för att säga något. Saknas viktiga uppgifter (till exempel försäljningspris eller skatt på uttag), säg det i stället för att gissa.
3. Vad som är viktigast att stämma av med en skatterådgivare innan man bestämmer sig, baserat på de riskflaggor och varningar som skickas med.
Avsluta alltid med en kort mening om att det här är en sammanfattning av kalkylens egna antaganden, inte skatterådgivning.
Max 220 ord totalt.`;

export async function POST(request: Request) {
  const client = getAnthropic();
  if (!client) {
    return NextResponse.json(
      { error: "AI-sammanfattning är inte påslagen för det här projektet ännu." },
      { status: 503 },
    );
  }

  let project: PropertyProject;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    project = migrateProject(body);
  } catch {
    return NextResponse.json({ error: "Kunde inte läsa projektet." }, { status: 400 });
  }

  if (project.compareScenarios.length === 0) {
    return NextResponse.json(
      { error: "Slå på minst ett alternativ under Antaganden innan ni sammanfattar." },
      { status: 422 },
    );
  }

  const results = calculateAllScenarios(project);
  const prompt = buildPrompt(project, results);

  try {
    const message = await client.messages.create({
      model: SUMMARY_MODEL,
      max_tokens: 700,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    if (!text) {
      return NextResponse.json({ error: "Fick inget svar från AI-tjänsten." }, { status: 502 });
    }

    return NextResponse.json({ summary: text });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Okänt fel";
    return NextResponse.json(
      { error: `AI-tjänsten svarade inte som väntat: ${message}` },
      { status: 502 },
    );
  }
}

function buildPrompt(project: PropertyProject, results: ScenarioResult[]): string {
  const lines: string[] = [];

  lines.push("OBJEKT");
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
  lines.push(`Mål som optimeras mot: ${project.optimizationTarget}`);

  if (project.rental.enabled) {
    lines.push("");
    lines.push("UTHYRNING UNDER PROJEKTET");
    lines.push(
      `${project.rental.rentedWeeks} veckor à ${formatMoney(project.rental.rentPerWeek)} per vecka`,
    );
  }

  lines.push("");
  lines.push("ALTERNATIV SOM JÄMFÖRS");

  for (const r of results) {
    const isCompany = r.corporateTax !== null;
    lines.push("");
    lines.push(`## ${r.label}`);
    if (r.salePriceMissing) {
      lines.push("Går inte att räkna klart — försäljningspris saknas.");
      continue;
    }
    lines.push(`Vinst efter skatt (obelånat projektresultat): ${formatMoney(r.profitAfterTax)}`);
    if (isCompany) {
      lines.push(`Kvar i bolaget efter bolagsskatt: ${formatMoney(r.netRetainedInCompany)}`);
      lines.push(
        r.extractionRateUnknown
          ? "Skatt på att ta ut pengarna privat är inte ifylld — vad ägaren får i handen är okänt."
          : `Kvar till ägaren om allt tas ut privat: ${formatMoney(
              r.familyNetWorth.familyNetWorthDeltaModeB,
            )}`,
      );
    } else {
      lines.push(`Kvar till ägaren privat: ${formatMoney(r.netAvailablePrivately)}`);
    }
    lines.push(`Avkastning på egna pengar: ${formatPercent(r.roi.equityROI)}`);
    lines.push(`Pengar som måste finnas tillgängliga: ${formatMoney(r.cashFlow.peakCashRequirement)}`);
    lines.push(`Lägsta pris utan förlust: ${formatMoney(r.breakEven.breakEvenSalePrice)}`);
    if (r.rental.grossRentalIncome > 0) {
      lines.push(`Hyresintäkter under projektet: ${formatMoney(r.rental.grossRentalIncome)}`);
    }
    if (r.riskFlags.length > 0) {
      lines.push("Riskflaggor:");
      for (const f of r.riskFlags) lines.push(`- (${f.severity}) ${f.text}`);
    }
    if (r.warnings.length > 0) {
      lines.push("Varningar:");
      for (const w of r.warnings) lines.push(`- ${w.text}`);
    }
  }

  return lines.join("\n");
}
