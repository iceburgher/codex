"use client";

import { useRef, useState } from "react";
import { formatMoney } from "@/lib/format";
import {
  PROSPECT_FIELD_LABELS,
  type ProspectExtract,
  type ProspectFieldKey,
} from "@/lib/prospect";
import type { PropertyProject } from "@/types";
import { Button, Card } from "../ui";

type Update = (updater: (draft: PropertyProject) => void) => void;

interface ImportResult {
  source: string;
  kind: "pdf" | "url";
  found: number;
  extract: ProspectExtract;
}

const FIELD_ORDER: ProspectFieldKey[] = [
  "address",
  "municipality",
  "propertyDesignation",
  "purchasePrice",
  "livingAreaSqm",
  "ancillaryAreaSqm",
  "plotAreaSqm",
  "constructionYear",
  "taxAssessmentValue",
  "existingMortgageDeeds",
  "heatingAnnual",
  "electricityAnnual",
  "waterSewerAnnual",
  "wasteAnnual",
  "operatingCostAnnual",
  "propertyFeeAnnual",
];

const AREA_FIELD_SET = new Set<ProspectFieldKey>([
  "livingAreaSqm",
  "ancillaryAreaSqm",
  "plotAreaSqm",
]);
const PLAIN_FIELD_SET = new Set<ProspectFieldKey>(["constructionYear"]);
/**
 * Läser in objektuppgifter från ett prospekt eller en annonslänk. Allt som
 * hittas visas för granskning med textutdraget det kom ifrån, och användaren
 * bockar av vad som faktiskt ska skrivas in. Inget fylls i automatiskt.
 */
export function ProspectImport({ update }: { update: Update }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [chosen, setChosen] = useState<Set<ProspectFieldKey>>(new Set());
  const [applied, setApplied] = useState(false);

  async function run(request: () => Promise<Response>) {
    setBusy(true);
    setError(null);
    setResult(null);
    setApplied(false);
    try {
      const response = await request();
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Kunde inte läsa in objektet.");
        return;
      }
      setResult(data as ImportResult);
      setChosen(new Set(Object.keys(data.extract) as ProspectFieldKey[]));
    } catch {
      setError("Kunde inte nå servern. Försök igen.");
    } finally {
      setBusy(false);
    }
  }

  function importFile(file: File) {
    const form = new FormData();
    form.append("file", file);
    void run(() => fetch("/api/import-listing", { method: "POST", body: form }));
  }

  function importUrl() {
    if (url.trim().length === 0) return;
    void run(() =>
      fetch("/api/import-listing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      }),
    );
  }

  function apply() {
    if (!result) return;
    const e = result.extract;

    update((d) => {
      if (chosen.has("address") && e.address) d.facts.address = e.address.value;
      if (chosen.has("municipality") && e.municipality) d.facts.municipality = e.municipality.value;
      if (chosen.has("propertyDesignation") && e.propertyDesignation) {
        d.facts.propertyDesignation = e.propertyDesignation.value;
      }
      if (chosen.has("livingAreaSqm") && e.livingAreaSqm) {
        d.facts.livingAreaSqm = e.livingAreaSqm.value;
      }
      if (chosen.has("ancillaryAreaSqm") && e.ancillaryAreaSqm) {
        d.facts.ancillaryAreaSqm = e.ancillaryAreaSqm.value;
      }
      if (chosen.has("plotAreaSqm") && e.plotAreaSqm) d.facts.plotAreaSqm = e.plotAreaSqm.value;
      if (chosen.has("constructionYear") && e.constructionYear) {
        d.facts.constructionYear = e.constructionYear.value;
      }
      if (chosen.has("purchasePrice") && e.purchasePrice) {
        d.inputs.purchasePrice = e.purchasePrice.value;
      }
      if (chosen.has("taxAssessmentValue") && e.taxAssessmentValue) {
        d.inputs.priorYearTaxAssessmentValue = e.taxAssessmentValue.value;
      }
      if (chosen.has("existingMortgageDeeds") && e.existingMortgageDeeds) {
        d.inputs.existingMortgageDeeds = e.existingMortgageDeeds.value;
      }

      if (chosen.has("heatingAnnual") && e.heatingAnnual) {
        d.operatingCosts.heatingAnnual = e.heatingAnnual.value;
      }
      if (chosen.has("electricityAnnual") && e.electricityAnnual) {
        d.operatingCosts.electricityAnnual = e.electricityAnnual.value;
      }
      if (chosen.has("waterSewerAnnual") && e.waterSewerAnnual) {
        d.operatingCosts.waterSewerAnnual = e.waterSewerAnnual.value;
      }
      if (chosen.has("wasteAnnual") && e.wasteAnnual) {
        d.operatingCosts.wasteAnnual = e.wasteAnnual.value;
      }
      if (chosen.has("propertyFeeAnnual") && e.propertyFeeAnnual) {
        d.operatingCosts.propertyFeeAnnual = e.propertyFeeAnnual.value;
      }
      if (chosen.has("operatingCostAnnual") && e.operatingCostAnnual) {
        // Summan kommer bara med när prospektet saknar enskilda poster, så
        // den kan läggas på "Övrigt" utan att något dubbelräknas.
        d.operatingCosts.otherAnnual = e.operatingCostAnnual.value;
      }

      // Ett namnlöst projekt får sin adress som namn — annars rörs namnet inte.
      if (chosen.has("address") && e.address && /^Nytt projekt/.test(d.name)) {
        d.name = e.address.value;
      }
    });

    setApplied(true);
  }

  const keys = result ? (Object.keys(result.extract) as ProspectFieldKey[]) : [];

  return (
    <Card
      title="Läs in från prospekt eller länk"
      subtitle="Ladda upp ett prospekt som PDF eller klistra in länken till annonsen. Du får granska allt som hittas innan något fylls i."
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="dark" disabled={busy} onClick={() => fileInput.current?.click()}>
          {busy ? "Läser…" : "Ladda upp prospekt"}
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) importFile(file);
            e.target.value = "";
          }}
        />

        <span className="text-sm text-muted">eller</span>

        <input
          type="url"
          value={url}
          disabled={busy}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") importUrl();
          }}
          placeholder="https://…"
          className="min-w-[260px] flex-1 rounded-full bg-surface-muted px-5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent/40"
        />
        <Button disabled={busy || url.trim().length === 0} onClick={importUrl}>
          Hämta
        </Button>
      </div>

      {error && (
        <p className="mt-4 rounded-2xl bg-negative-soft px-4 py-3 text-sm text-negative">{error}</p>
      )}

      {result && (
        <div className="mt-5">
          {keys.length === 0 ? (
            <p className="rounded-2xl bg-warn-soft px-4 py-3 text-sm text-warn">
              Inga uppgifter kunde tolkas från {result.source}. Fyll i fälten för hand nedan.
            </p>
          ) : (
            <>
              <p className="mb-3 text-sm text-muted">
                {result.found} {result.found === 1 ? "uppgift" : "uppgifter"} hittades i{" "}
                {result.source}. Bocka av det som inte stämmer.
              </p>

              <ul className="space-y-2">
                {FIELD_ORDER.filter((k) => keys.includes(k)).map((key) => {
                  const field = result.extract[key];
                  if (!field) return null;
                  const on = chosen.has(key);

                  return (
                    <li key={key}>
                      <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-surface-muted px-4 py-3">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 accent-[var(--accent-strong)]"
                          checked={on}
                          onChange={() => {
                            const next = new Set(chosen);
                            if (on) next.delete(key);
                            else next.add(key);
                            setChosen(next);
                            setApplied(false);
                          }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-baseline justify-between gap-2">
                            <span className="text-sm text-muted">{PROSPECT_FIELD_LABELS[key]}</span>
                            <span className="numeric text-sm font-semibold">
                              {formatFieldValue(key, field.value)}
                            </span>
                          </span>
                          <span className="mt-1 block truncate text-xs text-muted">
                            ur texten: ”{field.evidence}”
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button variant="primary" disabled={chosen.size === 0} onClick={apply}>
                  Fyll i {chosen.size} {chosen.size === 1 ? "uppgift" : "uppgifter"}
                </Button>
                {applied && (
                  <span className="text-sm font-medium text-positive">
                    Ifyllt. Kontrollera fälten nedan.
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      )}

      <p className="mt-4 text-xs leading-relaxed text-muted">
        Uppgifter ur ett prospekt är säljarens, inte kontrollerade fakta. Taxeringsvärde och
        driftkostnad är särskilt värda att stämma av mot källan innan de används i kalkylen.
      </p>
    </Card>
  );
}

function formatFieldValue(key: ProspectFieldKey, value: string | number): string {
  if (typeof value === "string") return value;
  if (AREA_FIELD_SET.has(key)) return `${value} m²`;
  if (PLAIN_FIELD_SET.has(key)) return String(value);
  return formatMoney(value);
}
