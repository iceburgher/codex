"use client";

import { useState } from "react";
import { formatMoney, formatPercent } from "@/lib/format";
import type { ScenarioResult, ScenarioType } from "@/types";

const PRIVATE_SCENARIOS: ScenarioType[] = ["PRIVATE_EQUITY", "PRIVATE_DEBT"];

export interface Side {
  key: "private" | "company";
  title: string;
  financing: string;
  best: ScenarioResult | null;
  blockedReason: string | null;
  /** Sant när det enda som saknas är skattesatsen över gränsbeloppet. */
  needsExtractionRate: boolean;
}

/**
 * Delar upp resultaten i de två läger frågan egentligen står mellan: äga
 * privat eller äga i bolag. Inom varje läger vinner den finansiering som ger
 * mest kvar efter skatt.
 */
export function splitSides(results: ScenarioResult[]): [Side, Side] {
  const build = (
    key: Side["key"],
    title: string,
    financing: string,
    members: ScenarioResult[],
  ): Side => {
    const usable = members.filter((r) => !r.salePriceMissing && !r.extractionRateUnknown);
    const best = usable.reduce<ScenarioResult | null>(
      (acc, r) =>
        acc === null ||
        r.familyNetWorth.familyNetWorthDeltaModeB > acc.familyNetWorth.familyNetWorthDeltaModeB
          ? r
          : acc,
      null,
    );

    let blockedReason: string | null = null;
    let needsExtractionRate = false;
    if (members.length === 0) blockedReason = "Inget alternativ valt";
    else if (best === null) {
      if (members.some((r) => r.salePriceMissing)) {
        blockedReason = "Fyll i vad ni tror att ni kan sälja för, högst upp.";
      } else {
        blockedReason = "Fyll i vad det kostar i skatt att ta ut vinsten ur bolaget.";
        needsExtractionRate = true;
      }
    }

    return { key, title, financing, best, blockedReason, needsExtractionRate };
  };

  return [
    build(
      "private",
      "Privat ägande",
      "Ni lånar och lägger in egna pengar. De egna pengarna måste först tas ut ur bolaget som lön eller utdelning, och det kostar skatt.",
      results.filter((r) => PRIVATE_SCENARIOS.includes(r.scenario)),
    ),
    build(
      "company",
      "Bolaget äger",
      "Bolaget lånar och använder pengar som redan finns i kassan. Ingen skatt förrän ni vill ta ut vinsten.",
      results.filter((r) => !PRIVATE_SCENARIOS.includes(r.scenario)),
    ),
  ];
}

/** Huvudnumret för ett objekt: privat mot bolag, och skillnaden i kronor. */
export function HeadToHead({
  results,
  onGoToInput,
  onSetExtractionRate,
}: {
  results: ScenarioResult[];
  onGoToInput?: () => void;
  /** Sätter skatten över gränsbeloppet för bolagsalternativen. */
  onSetExtractionRate?: (rate: number) => void;
}) {
  const [privateSide, companySide] = splitSides(results);
  const bothKnown = privateSide.best !== null && companySide.best !== null;

  const diff = bothKnown
    ? privateSide.best!.familyNetWorth.familyNetWorthDeltaModeB -
      companySide.best!.familyNetWorth.familyNetWorthDeltaModeB
    : null;

  const winner =
    diff === null ? null : Math.abs(diff) < 1000 ? "tie" : diff > 0 ? "private" : "company";

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Privat eller via bolaget?</h2>
          <p className="mt-1 text-sm text-muted">
            Samma hus, samma renovering, samma pris vid försäljning. Det enda som skiljer är vem
            som står som ägare — och vad det kostar i skatt att få ut pengarna till er själva.
          </p>
        </div>
      </div>

      <div className="grid items-stretch gap-4 lg:grid-cols-[1fr_auto_1fr]">
        <SideCard
          side={privateSide}
          highlighted={winner === "private"}
          onSetExtractionRate={onSetExtractionRate}
        />

        <div className="flex items-center justify-center lg:w-40">
          <div className="card flex w-full flex-col items-center px-4 py-5 text-center print-block">
            {diff === null ? (
              <>
                <p className="text-xs text-muted">Skillnad</p>
                <p className="mt-1 text-sm font-medium">Går inte att räkna ut ännu</p>
                {onGoToInput && (
                  <button
                    type="button"
                    onClick={onGoToInput}
                    className="mt-3 rounded-full bg-ink px-4 py-2 text-xs font-medium text-white hover:opacity-90"
                  >
                    Fyll i det som saknas
                  </button>
                )}
              </>
            ) : winner === "tie" ? (
              <>
                <p className="text-xs text-muted">Skillnad</p>
                <p className="numeric mt-1 text-xl font-semibold">≈ 0 kr</p>
                <p className="mt-1 text-xs leading-snug text-muted">
                  Så gott som lika. Låt annat avgöra.
                </p>
              </>
            ) : (
              <>
                <p className="text-xs text-muted">
                  {winner === "private" ? "Privat ger mer" : "Bolaget ger mer"}
                </p>
                <p className="numeric mt-1 text-2xl font-semibold tracking-tight text-accent-strong">
                  {formatMoney(Math.abs(diff))}
                </p>
                <p className="mt-1 text-xs leading-snug text-muted">mer kvar till er</p>
              </>
            )}
          </div>
        </div>

        <SideCard
          side={companySide}
          highlighted={winner === "company"}
          onSetExtractionRate={onSetExtractionRate}
        />
      </div>
    </section>
  );
}

function SideCard({
  side,
  highlighted,
  onSetExtractionRate,
}: {
  side: Side;
  highlighted: boolean;
  onSetExtractionRate?: (rate: number) => void;
}) {
  const r = side.best;

  return (
    <article className={`${highlighted ? "card-accent" : "card"} p-6 print-block`}>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">{side.title}</h3>
          <p className="mt-1 text-xs leading-snug text-muted">{side.financing}</p>
        </div>
        {highlighted && (
          <span className="shrink-0 rounded-full bg-accent-soft px-3 py-1 text-[11px] font-semibold text-accent-strong">
            Ger mest
          </span>
        )}
      </header>

      {r === null ? (
        <div className="rounded-2xl bg-surface-muted px-4 py-5">
          <p className="text-sm text-muted">{side.blockedReason}</p>
          {side.needsExtractionRate && onSetExtractionRate && (
            <ExtractionRatePrompt onSet={onSetExtractionRate} />
          )}
        </div>
      ) : (
        <>
          <div className="mb-5">
            <p className="text-sm text-muted">Kvar till er när allt är sålt och skattat</p>
            <p
              className={`numeric mt-1 text-[34px] font-semibold leading-none tracking-tight ${
                r.familyNetWorth.familyNetWorthDeltaModeB < 0
                  ? "text-negative"
                  : highlighted
                    ? "text-accent-strong"
                    : ""
              }`}
            >
              {formatMoney(r.familyNetWorth.familyNetWorthDeltaModeB)}
            </p>
            <p className="mt-2 text-xs text-muted">Räknat på: {r.label}</p>
          </div>

          <dl className="space-y-2.5 text-sm">
            <Row label="Vinst på affären efter skatt" value={formatMoney(r.profitAfterTax)} />
            <Row label="Skatt och avgifter" value={formatMoney(r.totalTax)} />
            <Row label="Pengar ni måste ha tillgängliga" value={formatMoney(r.cashFlow.peakCashRequirement)} />
            <Row label="Avkastning på egna pengar" value={formatPercent(r.roi.equityROI)} />
            <Row label="Lägsta pris utan förlust" value={formatMoney(r.breakEven.breakEvenSalePrice)} />
          </dl>
        </>
      )}
    </article>
  );
}

/**
 * Skatten över gränsbeloppet är det enda som stoppar jämförelsen, så den
 * frågas efter här i stället för att gömmas i en annan flik. Den har medvetet
 * inget standardvärde — 3:12 beror på ägarnas egna förhållanden.
 */
function ExtractionRatePrompt({ onSet }: { onSet: (rate: number) => void }) {
  const [value, setValue] = useState("");

  return (
    <div className="mt-4">
      <label className="block text-xs font-medium">Skatt när ni tar ut vinsten</label>
      <div className="mt-2 flex gap-2">
        <span className="relative flex-1">
          <input
            type="number"
            inputMode="decimal"
            step={0.1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder="t.ex. 30"
            className="numeric w-full rounded-full bg-surface px-4 py-2 pr-8 text-sm outline-none focus:ring-2 focus:ring-accent/40"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">
            %
          </span>
        </span>
        <button
          type="button"
          onClick={submit}
          className="rounded-full bg-ink px-4 py-2 text-xs font-medium text-white hover:opacity-90"
        >
          Räkna
        </button>
      </div>
      <p className="mt-2 text-xs leading-snug text-muted">
        Den del som ryms i gränsbeloppet beskattas lägre. Hur mycket det blir beror på era
        förhållanden — fråga er rådgivare.
      </p>
    </div>
  );

  function submit() {
    const parsed = Number(value.replace(",", "."));
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 100) onSet(parsed / 100);
  }
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="numeric font-medium">{value}</dd>
    </div>
  );
}
