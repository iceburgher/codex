"use client";

import { useEffect, useRef, useState } from "react";
import { applyAssistantPatch } from "@/lib/assistantPatch";
import type { AiChatMessage, PropertyProject } from "@/types";

/**
 * En flytande chatt i stället för en engångsknapp, så den syns oavsett
 * vilken flik man står på — den finns utanför flikarnas villkorliga
 * rendering och tappar därför aldrig sitt läge när man byter flik.
 * Historiken sparas i projektet precis som alla andra fält, via samma
 * `update()` som resten av gränssnittet, så den följer med lokalt och till
 * molnet på samma sätt.
 */
export function AiAssistant({
  project,
  update,
}: {
  project: PropertyProject;
  update: (updater: (draft: PropertyProject) => void) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [open, project.aiChat.length]);

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
    <div className="no-print fixed bottom-5 right-5 z-40">
      {open && (
        <div className="card mb-3 flex h-[28rem] w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden">
          <header className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <p className="text-sm font-semibold">AI-assistent</p>
              <p className="text-xs text-muted">Svarar på frågor, föreslår ändringar</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full p-1.5 text-muted hover:bg-surface-muted"
              aria-label="Stäng"
            >
              ✕
            </button>
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {project.aiChat.length === 0 && (
              <p className="text-xs leading-relaxed text-muted">
                Fråga vad som helst om siffrorna, eller föreslå en ändring — till exempel &quot;vad
                händer om vi hyr ut för 25 000 kr i månaden, 8 veckor om året?&quot;. Svaret bygger
                bara på det ni själva fyllt i, inte skatterådgivning.
              </p>
            )}
            {project.aiChat.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  m.role === "user" ? "ml-auto bg-ink text-white" : "bg-surface-muted"
                }`}
              >
                {m.text}
              </div>
            ))}
            {sending && (
              <div className="max-w-[85%] rounded-2xl bg-surface-muted px-3.5 py-2.5 text-sm text-muted">
                Tänker…
              </div>
            )}
          </div>

          {notice && (
            <p className="border-t border-border px-4 py-2 text-xs text-negative">{notice}</p>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            className="flex items-center gap-2 border-t border-border p-3"
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Skriv ett meddelande…"
              className="flex-1 rounded-full bg-surface-muted px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
            />
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              className="shrink-0 rounded-full bg-ink px-4 py-2 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              Skicka
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-ink text-sm font-medium text-white shadow-[var(--shadow-card)] hover:opacity-90"
        aria-label="AI-assistent"
      >
        {open ? "✕" : "AI"}
      </button>
    </div>
  );
}
