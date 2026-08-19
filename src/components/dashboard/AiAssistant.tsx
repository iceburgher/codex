"use client";

import { useEffect, useRef, useState } from "react";
import { applyAssistantPatch } from "@/lib/assistantPatch";
import type { AiChatMessage, PropertyProject } from "@/types";

/**
 * En modul i sidan i stället för en flytande ruta — den renderas utanför
 * flikarnas villkorliga innehåll, direkt under flikraden, så den syns och
 * behåller sitt läge oavsett vilken flik man står på.
 * Historiken sparas i projektet precis som alla andra fält, via samma
 * `update()` som resten av gränssnittet, så den följer med lokalt och till
 * molnet på samma sätt.
 */
/** Bryter svaret i stycken på tomrader, eller enkla radbrytningar om inga tomrader finns. */
function paragraphsOf(text: string): string[] {
  const byBlankLine = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (byBlankLine.length > 1) return byBlankLine;

  const byLine = text
    .split("\n")
    .map((p) => p.trim())
    .filter(Boolean);
  return byLine.length > 0 ? byLine : [text];
}

export function AiAssistant({
  project,
  update,
}: {
  project: PropertyProject;
  update: (updater: (draft: PropertyProject) => void) => void;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [project.aiChat.length, sending]);

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setDraft("");
    setNotice(null);
    setSending(true);

    const userMsg: AiChatMessage = { role: "user", text, ts: new Date().toISOString() };
    const historyForRequest = [...project.aiChat, userMsg];

    // Frågan syns direkt, svaret hinner ikapp strax efter.
    update((d) => void d.aiChat.push(userMsg));

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ project, history: historyForRequest }),
      });
      const data = (await res.json()) as { reply?: string; patch?: unknown; error?: string };

      if (!res.ok) {
        setNotice(data.error ?? "Något gick fel. Försök igen.");
        return;
      }

      update((d) => {
        if (data.patch) applyAssistantPatch(d, data.patch);
        d.aiChat.push({
          role: "assistant",
          text: data.reply ?? "Uppdaterat.",
          ts: new Date().toISOString(),
        });
      });
    } catch {
      setNotice("Kunde inte nå AI-tjänsten. Kontrollera anslutningen och försök igen.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="card print-block flex flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Chat</h2>
          <p className="mt-0.5 text-xs text-muted">
            Svarar på frågor om kalkylen och kan ändra antaganden åt er
          </p>
        </div>
      </header>

      <div ref={listRef} className="max-h-80 space-y-3 overflow-y-auto px-5 py-4">
        {project.aiChat.length === 0 && (
          <p className="text-sm leading-relaxed text-muted">
            Fråga vad som helst om siffrorna, eller föreslå en ändring — till exempel &quot;vad
            händer om vi hyr ut för 25 000 kr i månaden, 8 veckor om året?&quot; eller &quot;höj
            lånet till 3,2 miljoner&quot;. Svaret bygger bara på det ni själva fyllt i, inte
            skatterådgivning.
          </p>
        )}
        {project.aiChat.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] space-y-2.5 rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
              m.role === "user" ? "ml-auto bg-ink text-white" : "bg-surface-muted"
            }`}
          >
            {paragraphsOf(m.text).map((paragraph, j) => (
              <p key={j}>{paragraph}</p>
            ))}
          </div>
        ))}
        {sending && (
          <div className="max-w-[85%] rounded-2xl bg-surface-muted px-3.5 py-2.5 text-sm text-muted">
            Tänker…
          </div>
        )}
      </div>

      {notice && <p className="border-t border-border px-5 py-2.5 text-sm text-negative">{notice}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="no-print flex items-center gap-2 border-t border-border p-4"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Skriv ett meddelande…"
          className="flex-1 rounded-full bg-surface-muted px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent/40"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="shrink-0 rounded-full bg-ink px-5 py-2.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          Skicka
        </button>
      </form>
    </section>
  );
}
