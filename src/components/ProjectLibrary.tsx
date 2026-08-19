"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { calculateScenario } from "@/calculations/engine";
import { calculateRenovation } from "@/calculations/renovation";
import { downloadFile, slugify } from "@/lib/download";
import {
  formatDate,
  formatMissing,
  formatMoney,
  formatPercent,
  whenAssessable,
} from "@/lib/format";
import { useProjectStore } from "@/lib/store";
import type { ImportReport } from "@/lib/schema";
import { SCENARIO_LABELS, type ProjectStatus, type PropertyProject } from "@/types";
import { IconSearch } from "./Icons";
import { Button, Card, SelectField } from "./ui";

type SortKey =
  | "name"
  | "updatedAt"
  | "purchasePrice"
  | "expectedSalePrice"
  | "profit"
  | "roi";

const STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: "Utkast",
  active: "Aktivt",
  renovation: "Under renovering",
  for_sale: "Till salu",
  sold: "Sålt",
  archived: "Arkiverat",
};

interface ProjectSummary {
  project: PropertyProject;
  profitAfterTax: number;
  equityROI: number;
  riskCount: number;
  salePriceMissing: boolean;
  extractionRateUnknown: boolean;
}

export function ProjectLibrary() {
  const store = useProjectStore();
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("updatedAt");
  const [showArchived, setShowArchived] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const summaries = useMemo<ProjectSummary[]>(() => {
    return store.projects.map((project) => {
      const result = calculateScenario(project, project.selectedScenario);
      return {
        project,
        profitAfterTax: result.netAvailablePrivately,
        equityROI: result.roi.equityROI,
        riskCount: result.riskFlags.filter((f) => f.severity === "high").length,
        salePriceMissing: result.salePriceMissing,
        extractionRateUnknown: result.extractionRateUnknown,
      };
    });
  }, [store.projects]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = summaries.filter(({ project }) => {
      if (project.archived !== showArchived) return false;
      if (!q) return true;
      return (
        project.name.toLowerCase().includes(q) ||
        (project.facts.address ?? "").toLowerCase().includes(q) ||
        (project.facts.municipality ?? "").toLowerCase().includes(q)
      );
    });

    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case "name":
          return a.project.name.localeCompare(b.project.name);
        case "purchasePrice":
          return (b.project.inputs.purchasePrice ?? 0) - (a.project.inputs.purchasePrice ?? 0);
        case "expectedSalePrice":
          return (
            (b.project.inputs.expectedSalePrice ?? 0) - (a.project.inputs.expectedSalePrice ?? 0)
          );
        case "profit":
          return b.profitAfterTax - a.profitAfterTax;
        case "roi":
          return b.equityROI - a.equityROI;
        default:
          return b.project.updatedAt.localeCompare(a.project.updatedAt);
      }
    });
  }, [summaries, query, sortKey, showArchived]);

  async function handleCreate() {
    const project = await store.createBlank();
    router.push(`/projects/${project.id}`);
  }

  async function handleExport(ids: string[], filename: string) {
    const json = await store.exportProjects(ids);
    downloadFile(filename, json, "application/json");
  }

  async function handleImportFile(file: File) {
    try {
      const report = await store.importProjects(JSON.parse(await file.text()));
      setImportReport(report);
    } catch {
      setImportReport({
        imported: 0,
        skipped: 0,
        issues: [
          {
            projectName: file.name,
            path: "(file)",
            message: "Filen är inte giltig JSON.",
            severity: "error",
          },
        ],
      });
    }
  }

  function toggleSelected(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight">
            Era fastighetsprojekt
          </h1>
          <p className="mt-1 text-sm text-muted">
            Ett projekt är ett objekt. Alla ägarformer räknas på samma uppgifter om huset.
          </p>
        </div>

        <label className="no-print relative hidden min-w-[320px] items-center sm:flex">
          <span className="sr-only">Sök</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Sök på namn, adress eller kommun…"
            className="w-full rounded-full bg-surface py-3.5 pl-6 pr-14 text-sm shadow-[var(--shadow-card)] outline-none focus:ring-2 focus:ring-accent/40"
          />
          <span className="pointer-events-none absolute right-2 flex h-10 w-10 items-center justify-center rounded-full bg-ink text-white">
            <IconSearch className="h-4 w-4" />
          </span>
        </label>

        <div className="no-print flex flex-wrap gap-2">
          <Button variant="dark" onClick={handleCreate}>
            Nytt projekt +
          </Button>
          <Button onClick={() => fileInput.current?.click()}>Importera</Button>
          <Button
            disabled={selected.length === 0}
            onClick={() => handleExport(selected, `projects-bundle-${selected.length}.json`)}
          >
            Exportera valda ({selected.length})
          </Button>
          <Link href={`/compare${selected.length ? `?ids=${selected.join(",")}` : ""}`}>
            <Button disabled={selected.length < 2}>Jämför valda</Button>
          </Link>
          <input
            ref={fileInput}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImportFile(file);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div className="w-56">
          <SelectField<SortKey>
            label="Sortera efter"
            value={sortKey}
            onChange={setSortKey}
            options={[
              { value: "updatedAt", label: "Senast ändrat" },
              { value: "name", label: "Namn" },
              { value: "purchasePrice", label: "Köpeskilling" },
              { value: "expectedSalePrice", label: "Förväntat försäljningspris" },
              { value: "profit", label: "Resultat efter skatt" },
              { value: "roi", label: "Avkastning" },
            ]}
          />
        </div>
        <Button
          variant={showArchived ? "primary" : "default"}
          onClick={() => setShowArchived(!showArchived)}
        >
          {showArchived ? "Visar arkiverade" : "Visa arkiverade"}
        </Button>
      </div>

      {importReport && (
        <div className="mb-4">
          <Card
            title={`Import: ${importReport.imported} inlästa, ${importReport.skipped} överhoppade`}
            actions={
              <Button variant="ghost" onClick={() => setImportReport(null)}>
                Stäng
              </Button>
            }
          >
            {importReport.issues.length === 0 ? (
              <p className="text-sm text-muted">Inga anmärkningar.</p>
            ) : (
              <ul className="space-y-1 text-xs">
                {importReport.issues.map((issue, i) => (
                  <li key={i} className="flex gap-2">
                    <span
                      className={
                        issue.severity === "error"
                          ? "font-semibold text-negative"
                          : "font-semibold text-warn"
                      }
                    >
                      {issue.severity === "error" ? "Fel" : "Varning"}
                    </span>
                    <span className="text-muted">
                      {issue.projectName} · {issue.path}
                    </span>
                    <span>{issue.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {store.loading ? (
        <p className="text-sm text-muted">Laddar projekt…</p>
      ) : visible.length === 0 ? (
        <Card title={showArchived ? "Inga arkiverade projekt" : "Inga projekt än"}>
          <p className="text-xs text-muted">
            {showArchived
              ? "Arkiverade projekt hamnar här och kan återställas när som helst."
              : "Skapa ett nytt projekt eller importera en fil för att komma igång."}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map(
            ({
              project,
              profitAfterTax,
              equityROI,
              riskCount,
              salePriceMissing,
              extractionRateUnknown,
            }) => (
            <article
              key={project.id}
              className="card p-5"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 accent-[var(--accent)]"
                      checked={selected.includes(project.id)}
                      onChange={() => toggleSelected(project.id)}
                      aria-label={`Select ${project.name}`}
                    />
                    <Link
                      href={`/projects/${project.id}`}
                      className="truncate text-base font-semibold hover:underline"
                    >
                      {project.name}
                    </Link>
                  </div>
                  <p className="mt-1 truncate text-sm text-muted">
                    {project.facts.address ?? "Ingen adress"}
                    {project.facts.municipality ? ` · ${project.facts.municipality}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium">
                    {STATUS_LABELS[project.status]}
                  </span>
                  {riskCount > 0 && (
                    <span className="rounded bg-danger-soft px-1.5 py-0.5 text-[10px] font-semibold text-negative">
                      {riskCount} {riskCount === 1 ? "fråga" : "frågor"} för rådgivare
                    </span>
                  )}
                </div>
              </div>

              <p className="mb-3 text-xs text-muted">
                Ägarform: {SCENARIO_LABELS[project.selectedScenario]}
              </p>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <Row label="Köpeskilling" value={formatMissing(project.inputs.purchasePrice)} />
                <Row
                  label="Renovering"
                  value={formatMoney(renovationBudget(project))}
                />
                <Row
                  label="Förväntat pris"
                  value={formatMissing(project.inputs.expectedSalePrice)}
                />
                <Row
                  label="Kvar efter skatt"
                  value={whenAssessable(
                    salePriceMissing || extractionRateUnknown,
                    () => formatMoney(profitAfterTax),
                    extractionRateUnknown ? "Kräver skattesats" : undefined,
                  )}
                  tone={
                    salePriceMissing || extractionRateUnknown
                      ? undefined
                      : profitAfterTax < 0
                        ? "negative"
                        : "positive"
                  }
                />
                <Row
                  label="Avkastning"
                  value={whenAssessable(
                    salePriceMissing || extractionRateUnknown,
                    () => formatPercent(equityROI),
                    extractionRateUnknown ? "Kräver skattesats" : undefined,
                  )}
                />
                <Row label="Ändrat" value={formatDate(project.updatedAt)} />
              </dl>

              <div className="mt-3 flex flex-wrap gap-1.5">
                <Link href={`/projects/${project.id}`}>
                  <Button variant="primary" size="sm">Öppna</Button>
                </Link>
                <Button size="sm" onClick={() => void store.duplicate(project.id)}>Kopiera</Button>
                <Button
                  onClick={() =>
                    handleExport([project.id], `${slugify(project.name)}.json`)
                  }
                >
                  Exportera
                </Button>
                {project.archived ? (
                  <Button size="sm" onClick={() => void store.restore(project.id)}>Återställ</Button>
                ) : (
                  <Button size="sm" onClick={() => void store.archive(project.id)}>Arkivera</Button>
                )}
                {confirmDelete === project.id ? (
                  <>
                    <Button
                      variant="danger"
                      onClick={() => {
                        void store.remove(project.id);
                        setConfirmDelete(null);
                      }}
                    >
                      Ta bort på riktigt
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(null)}>
                      Avbryt
                    </Button>
                  </>
                ) : (
                  <Button variant="danger" size="sm" onClick={() => setConfirmDelete(project.id)}>
                    Ta bort
                  </Button>
                )}
              </div>
            </article>
            ),
          )}
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
}) {
  const toneClass =
    tone === "negative" ? "text-negative" : tone === "positive" ? "text-positive" : "";
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className={`numeric text-right font-medium ${toneClass}`}>{value}</dd>
    </>
  );
}

function renovationBudget(project: PropertyProject): number {
  return calculateRenovation(project.renovation).renovationTotalGross;
}
