import type { PropertyProject, SavedProjectFile } from "@/types";
import { createSeedProject } from "@/data/seedProject";
import { SCHEMA_VERSION, createBlankProject } from "./defaults";
import { migrateProject } from "./migrations";
import { type ImportIssue, type ImportReport, savedProjectFileSchema } from "./schema";

export interface ProjectRepository {
  list(): Promise<PropertyProject[]>;
  get(id: string): Promise<PropertyProject | null>;
  create(project: PropertyProject): Promise<PropertyProject>;
  update(id: string, project: PropertyProject): Promise<PropertyProject>;
  delete(id: string): Promise<void>;
  archive(id: string): Promise<void>;
  restore(id: string): Promise<void>;
  duplicate(id: string, newName?: string): Promise<PropertyProject>;
  import(payload: unknown): Promise<{ projects: PropertyProject[]; report: ImportReport }>;
  export(ids: string[]): Promise<string>;
}

const STORAGE_KEY = "pic.projects.v1";
const SEED_FLAG_KEY = "pic.seedInitialized";

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Browser-local persistence. The repository interface is the seam: swapping in
 * a backend later means implementing this interface, not touching the
 * calculation engine.
 */
export class LocalStorageProjectRepository implements ProjectRepository {
  private readAll(): PropertyProject[] {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed.map((p) => migrateProject(p as Record<string, unknown>));
    } catch {
      return [];
    }
  }

  private writeAll(projects: PropertyProject[]): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  }

  async list(): Promise<PropertyProject[]> {
    return this.readAll();
  }

  async get(id: string): Promise<PropertyProject | null> {
    return this.readAll().find((p) => p.id === id) ?? null;
  }

  async create(project: PropertyProject): Promise<PropertyProject> {
    const all = this.readAll();
    const stored: PropertyProject = { ...project, updatedAt: new Date().toISOString() };
    all.push(stored);
    this.writeAll(all);
    return stored;
  }

  async update(id: string, project: PropertyProject): Promise<PropertyProject> {
    const all = this.readAll();
    const index = all.findIndex((p) => p.id === id);
    const stored: PropertyProject = { ...project, id, updatedAt: new Date().toISOString() };
    if (index === -1) all.push(stored);
    else all[index] = stored;
    this.writeAll(all);
    return stored;
  }

  async delete(id: string): Promise<void> {
    this.writeAll(this.readAll().filter((p) => p.id !== id));
  }

  async archive(id: string): Promise<void> {
    const all = this.readAll();
    const p = all.find((x) => x.id === id);
    if (!p) return;
    p.archived = true;
    p.status = "archived";
    p.updatedAt = new Date().toISOString();
    this.writeAll(all);
  }

  async restore(id: string): Promise<void> {
    const all = this.readAll();
    const p = all.find((x) => x.id === id);
    if (!p) return;
    p.archived = false;
    if (p.status === "archived") p.status = "draft";
    p.updatedAt = new Date().toISOString();
    this.writeAll(all);
  }

  async duplicate(id: string, newName?: string): Promise<PropertyProject> {
    const source = await this.get(id);
    if (!source) throw new Error(`Project ${id} not found`);
    // Deep clone so the copy shares no mutable state with the original.
    const clone: PropertyProject = JSON.parse(JSON.stringify(source));
    clone.id = newId();
    clone.name = newName ?? `${source.name} (copy)`;
    clone.createdAt = new Date().toISOString();
    clone.updatedAt = clone.createdAt;
    return this.create(clone);
  }

  async import(payload: unknown): Promise<{ projects: PropertyProject[]; report: ImportReport }> {
    const issues: ImportIssue[] = [];
    const normalized = normalizeImportPayload(payload);

    const parsed = savedProjectFileSchema.safeParse(normalized);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        issues.push({
          projectName: pathProjectName(normalized, issue.path),
          path: issue.path.join("."),
          message: issue.message,
          severity: "error",
        });
      }
      return { projects: [], report: { imported: 0, skipped: countProjects(normalized), issues } };
    }

    const existing = this.readAll();
    const existingIds = new Set(existing.map((p) => p.id));
    const imported: PropertyProject[] = [];

    for (const raw of parsed.data.projects) {
      const project = migrateProject(raw as unknown as Record<string, unknown>);

      if (existingIds.has(project.id)) {
        const oldId = project.id;
        project.id = newId();
        issues.push({
          projectName: project.name,
          path: "id",
          message: `Id ${oldId} fanns redan — projektet importerades med ett nytt id.`,
          severity: "warning",
        });
      }
      existingIds.add(project.id);

      for (const issue of missingValueWarnings(project)) issues.push(issue);

      existing.push(project);
      imported.push(project);
    }

    this.writeAll(existing);
    return {
      projects: imported,
      report: { imported: imported.length, skipped: 0, issues },
    };
  }

  async export(ids: string[]): Promise<string> {
    const all = this.readAll();
    const selected = ids.length > 0 ? all.filter((p) => ids.includes(p.id)) : all;
    const file: SavedProjectFile = {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      projects: selected,
    };
    return JSON.stringify(file, null, 2);
  }

  /** Creates the example starter project once, and never again after deletion. */
  async ensureSeed(): Promise<void> {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(SEED_FLAG_KEY) === "true") return;
    const all = this.readAll();
    if (all.length === 0) {
      await this.create(createSeedProject());
    }
    window.localStorage.setItem(SEED_FLAG_KEY, "true");
  }

  async createBlank(name?: string): Promise<PropertyProject> {
    return this.create(createBlankProject(newId(), name));
  }

  /** Ersätter den lokala kopian med molnets bild vid start. */
  async replaceAll(projects: PropertyProject[]): Promise<void> {
    this.writeAll(projects);
  }
}

function normalizeImportPayload(payload: unknown): unknown {
  if (Array.isArray(payload)) {
    return { schemaVersion: SCHEMA_VERSION, projects: payload };
  }
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    if ("projects" in obj) return obj;
    if ("project" in obj) {
      return { schemaVersion: obj.schemaVersion ?? SCHEMA_VERSION, projects: [obj.project] };
    }
    if ("id" in obj && "inputs" in obj) {
      return { schemaVersion: SCHEMA_VERSION, projects: [obj] };
    }
  }
  return payload;
}

function countProjects(payload: unknown): number {
  if (payload && typeof payload === "object" && "projects" in payload) {
    const list = (payload as { projects: unknown }).projects;
    return Array.isArray(list) ? list.length : 0;
  }
  return 0;
}

function pathProjectName(payload: unknown, path: PropertyKey[]): string {
  if (path[0] === "projects" && typeof path[1] === "number") {
    const list = (payload as { projects?: unknown[] })?.projects;
    const item = list?.[path[1]] as { name?: string } | undefined;
    return item?.name ?? `Project #${path[1] + 1}`;
  }
  return "(file)";
}

/**
 * Tax-sensitive values that are missing must stay missing and be reported —
 * they are never substituted with an assumption.
 */
function missingValueWarnings(project: PropertyProject): ImportIssue[] {
  const issues: ImportIssue[] = [];
  const checks: [string, unknown][] = [
    ["inputs.purchasePrice", project.inputs.purchasePrice],
    ["inputs.expectedSalePrice", project.inputs.expectedSalePrice],
    ["inputs.priorYearTaxAssessmentValue", project.inputs.priorYearTaxAssessmentValue],
    ["inputs.existingMortgageDeeds", project.inputs.existingMortgageDeeds],
  ];
  for (const [path, value] of checks) {
    if (value === null || value === undefined) {
      issues.push({
        projectName: project.name,
        path,
        message: "Värdet saknas och lämnas tomt — det fylls aldrig i med en gissning.",
        severity: "warning",
      });
    }
  }
  return issues;
}

export const projectRepository = new LocalStorageProjectRepository();
