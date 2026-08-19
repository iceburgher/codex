"use client";

import { useState } from "react";
import type { PropertyProject } from "@/types";

/**
 * Skickar projektet till servern, som räknar om det och ber Claude
 * sammanfatta resultatet i vanligt språk. Körs bara när användaren klickar
 * — aldrig automatiskt vid varje ändring — så det inte går ett AI-anrop per
 * tangenttryck.
 */
export function AiSummary({ project }: { project: PropertyProject }) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  async function run() {
    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(project),
      });
      const data = (await res.json()) as { summary?: string; error?: string };
      if (!res.ok || !data.summary) {
        setError(data.error ?? "Något gick fel. Försök igen.");
        setStatus("error");
        return;
      }
      setText(data.summary);
      setStatus("done");
    } catch {
      setError("Kunde inte nå AI-tjänsten. Kontrollera anslutningen och försök igen.");
      setStatus("error");
    }
  }

  return (
    <section className="card p-6 print-block">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">AI-sammanfattning</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            En kort sammanfattning av siffrorna ovan, i vanligt språk. Bygger bara på det ni
            själva har fyllt i — inte skatterådgivning.
          </p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={status === "loading"}
          className="no-print shrink-0 rounded-full bg-ink px-4 py-2 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {status === "loading"
            ? "Sammanfattar…"
            : status === "done"
              ? "Uppdatera sammanfattningen"
              : "Sammanfatta med AI"}
        </button>
      </div>

      {status === "error" && (
        <p className="mt-4 rounded-2xl bg-negative-soft px-4 py-3 text-sm text-negative">
          {error}
        </p>
      )}

      {text && (
        <div className="mt-4 space-y-3 text-sm leading-relaxed">
          {text
            .split("\n")
            .map((p) => p.trim())
            .filter(Boolean)
            .map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
        </div>
      )}
    </section>
  );
}
