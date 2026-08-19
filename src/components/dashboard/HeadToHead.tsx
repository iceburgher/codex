"use client";

import { memo, useState } from "react";
import { formatMoney, formatPercent } from "@/lib/format";
import type { ScenarioResult, ScenarioType } from "@/types";

const PRIVATE_SCENARIOS: ScenarioType[] = ["PRIVATE_EQUITY", "PRIVATE_DEBT"];

/**
 * Var pengarna hamnar är två olika frågor med två olika svar.
 *
 * Stannar vinsten i bolaget är bolagsskatten den enda skatt som betalats.
 * Ska den ut till ägarna tillkommer skatt på uttaget. Att blanda de två i
 * samma kolumn gör jämförelsen missvisande, så läget väljs uttryckligen.
 */
export type MoneyMode = "in_company" | "extracted";

export interface Side {
  key: "private" | "company";
  title: string;
  financing: string;
  best: ScenarioResult | null;
  blockedReason: string | null;
  /** Sant när det enda som saknas är skatten på uttaget. */
  needsExtractionRate: boolean;
}

/** Vad som blir kvar, räknat i det valda läget. */
function amountFor(r: ScenarioResult, mode: MoneyMode): number {
  const isCompany = r.corporateTax !== null;
  if (!isCompany) return r.profitAfterTax;
  return mode === "in_company" ? r.netRetainedInCompany : r.familyNetWorth.familyNetWorthDeltaModeB;
}

/** Skatten som faktiskt är betald i det valda läget. */
function taxFor(r: ScenarioResult, mode: MoneyMode): number {
  const isCompany = r.corporateTax !== null;
  if (!isCompany) return r.capitalGain.capitalGainTax + r.rental.privateRentalTax;

  const corporate = r.corporateTax?.companyTax ?? 0;
  const benefit = r.benefit?.combinedEconomicCost ?? 0;
  const extraction = mode === "extracted" ? (r.extraction?.ownerExtractionTax ?? 0) : 0;
  return corporate + benefit + extraction;
}

/** En summarad är bara meningsfull när den summerar mer än en post. */
function showsTotalTax(r: ScenarioResult, mode: MoneyMode): boolean {
  const isCompany = r.corporateTax !== null;
  if (!isCompany) return r.rental.privateRentalTax > 0;
  const benefit = r.benefit?.combinedEconomicCost ?? 0;
  return mode === "extracted" || benefit > 0;
}

/** Skatten på uttaget behöver bara vara känd i det läge som tar ut pengarna. */
function needsRate(r: ScenarioResult, mode: MoneyMode): boolean {
  return mode === "extracted" && r.extractionRateUnknown;
}

export function splitSides(results: ScenarioResult[], mode: MoneyMode): [Side, Side] {
  const build = (
    key: Side["key"],
    title: string,
    financing: string,
    members: ScenarioResult[],
  ): Side => {
    const usable = members.filter((r) => !r.salePriceMissing && !needsRate(r, mode));
    const best = usable.reduce<ScenarioResult | null>(
      (acc, r) => (acc === null || amountFor(r, mode) > amountFor(acc, mode) ? r : acc),
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
      "Bolaget lånar och använder pengar som redan finns i kassan.",
      results.filter((r) => !PRIVATE_SCENARIOS.includes(r.scenario)),
    ),
  ];
}

function HeadToHeadInner({
  results,
  onGoToInput,
  onSetExtractionRate,
}: {
  results: ScenarioResult[];
  onGoToInput?: () => void;
  onSetExtractionRate?: (rate: number) => void;
}) {
  const [mode, setMode] = useState<MoneyMode>("in_company");
  const [privateSide, companySide] = splitSides(results, mode);

  const diff =
    privateSide.best && companySide.best
      ? amountFor(privateSide.best, mode) - amountFor(companySide.best, mode)
      : null;

  const winner =
    diff === null ? null : Math.abs(diff) < 1000 ? "tie" : diff > 0 ? "private" : "company";

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Privat eller via bolaget?</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Samma hus, samma renovering, samma pris vid försäljning. Det enda som skiljer är vem
            som står som ägare — och vad det kostar i skatt.
          </p>
        </div>

        <div className="no-print flex rounded-full bg-surface p-1 shadow-[var(--shadow-card)]">
          {(
            [
              ["in_company", "Pengarna stannar i bolaget"],
              ["extracted", "Vi tar ut allt privat"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={`rounded-full px-4 py-2 text-xs font-medium transition-colors ${
                mode === value ? "bg-ink text-white" : "text-muted hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid items-stretch gap-4 lg:grid-cols-[1fr_auto_1fr]">
        <SideCard
          side={privateSide}
          mode={mode}
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
                  {mode === "in_company"
                    ? winner === "private"
                      ? "Privat har mer"
                      : "Bolaget har mer"
                    : winner === "private"
                      ? "Privat ger mer"
                      : "Bolaget ger mer"}
                </p>
                <p className="numeric mt-1 text-2xl font-semibold tracking-tight text-accent-strong">
                  {formatMoney(Math.abs(diff))}
                </p>
                <p className="mt-1 text-xs leading-snug text-muted">
                  {mode === "in_company"
                    ? "men bolagets pengar är inte uttagna än"
                    : "mer kvar till er"}
                </p>
              </>
            )}
          </div>
        </div>

        <SideCard
          side={companySide}
          mode={mode}
          highlighted={winner === "company"}
          onSetExtractionRate={onSetExtractionRate}
        />
      </div>
    </section>
  );
}

/**
 * Ritas bara om när siffrorna faktiskt ändrats. Under inmatning byts
 * projektet vid varje tangenttryck, men resultaten hinner ikapp först
 * efteråt — utan detta skulle hela vyn ritas om i onödan.
 */
export const HeadToHead = memo(HeadToHeadInner);

function SideCard({
  side,
  mode,
  highlighted,
  onSetExtractionRate,
}: {
  side: Side;
  mode: MoneyMode;
  highlighted: boolean;
  onSetExtractionRate?: (rate: number) => void;
}) {
  const r = side.best;
  const isCompany = side.key === "company";

  return (
    <article className={`${highlighted ? "card-accent" : "card"} p-6 print-block`}>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">{side.title}</h3>
          <p className="mt-1 text-xs leading-snug text-muted">{side.financing}</p>
        </div>
        {highlighted && (
          <span className="shrink-0 rounded-full bg-accent-soft px-3 py-1 text-[11px] font-semibold text-accent-strong">
            {mode === "in_company" ? "Störst belopp" : "Ger mest"}
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
            <p className="text-sm text-muted">
              {isCompany && mode === "in_company"
                ? "Kvar i bolaget efter bolagsskatt"
                : "Kvar till er när allt är sålt och skattat"}
            </p>
            <p
              className={`numeric mt-1 text-[34px] font-semibold leading-none tracking-tight ${
                amountFor(r, mode) < 0 ? "text-negative" : highlighted ? "text-accent-strong" : ""
              }`}
            >
              {formatMoney(amountFor(r, mode))}
            </p>
            <p className="mt-2 text-xs text-muted">Räknat på: {r.label}</p>
          </div>

          <dl className="space-y-2.5 text-sm">
            <Row
              label="Mäklare och försäljningskostnader"
              value={formatMoney(r.saleCosts.saleCostsTotal)}
            />
            {isCompany ? (
              <>
                <Row
                  label="Bolagsskatt på vinsten"
                  value={formatMoney(r.corporateTax?.companyTax ?? 0)}
                />
                {mode === "extracted" && (
                  <Row
                    label="Skatt när ni tar ut pengarna"
                    value={formatMoney(r.extraction?.ownerExtractionTax ?? 0)}
                  />
                )}
                {r.rental.grossRentalIncome > 0 && (
                  <>
                    <Row label="Hyresintäkter" value={formatMoney(r.rental.grossRentalIncome)} />
                    <Row
                      label="Uthyrningens resultat till bolaget"
                      value={formatMoney(r.rental.companyRentalProfit)}
                    />
                  </>
                )}
              </>
            ) : (
              <>
                <Row
                  label="Skatt på vinsten vid försäljning"
                  value={formatMoney(r.capitalGain.capitalGainTax)}
                />
                {r.rental.grossRentalIncome > 0 && (
                  <>
                    <Row label="Hyresintäkter" value={formatMoney(r.rental.grossRentalIncome)} />
                    {r.rental.privateRentalTax > 0 && (
                      <Row
                        label="Skatt på hyran"
                        value={formatMoney(r.rental.privateRentalTax)}
                      />
                    )}
                    <Row
                      label="Netto från uthyrningen"
                      value={formatMoney(r.rental.netRentalCashPrivate)}
                    />
                  </>
                )}
              </>
            )}
            {showsTotalTax(r, mode) && (
              <Row label="Skatt och avgifter totalt" value={formatMoney(taxFor(r, mode))} />
            )}
            <Row
              label="Pengar ni måste ha tillgängliga"
              value={formatMoney(r.cashFlow.peakCashRequirement)}
            />
            <Row label="Avkastning på egna pengar" value={formatPercent(r.roi.equityROI)} />
            <Row
              label="Lägsta pris utan förlust"
              value={formatMoney(r.breakEven.breakEvenSalePrice)}
            />
          </dl>

          {isCompany && mode === "in_company" && (
            <p className="mt-4 rounded-2xl bg-surface-muted px-4 py-3 text-xs leading-relaxed text-muted">
              {r.extractionRateUnknown
                ? "Pengarna ligger kvar i bolaget. Ska de till er privat tillkommer skatt — fyll i vilken under Antaganden."
                : `Pengarna ligger kvar i bolaget. Ska de till er privat kostar det ytterligare ${formatMoney(
                    r.extraction?.ownerExtractionTax ?? 0,
                  )} i skatt. Byt läge ovan för att se vad ni får i handen.`}
            </p>
          )}
        </>
      )}
    </article>
  );
}

/**
 * Skatten på uttaget behövs bara i det ena läget, så den frågas efter där
 * den saknas i stället för att gömmas i en annan flik.
 */
function ExtractionRatePrompt({ onSet }: { onSet: (rate: number) => void }) {
  const [value, setValue] = useState("");

  function submit() {
    const parsed = Number(value.replace(",", "."));
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 100) onSet(parsed / 100);
  }

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
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="numeric font-medium">{value}</dd>
    </div>
  );
}
