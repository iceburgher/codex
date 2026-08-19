import type { PropertyProject } from "@/types";
import type { LocalStorageProjectRepository } from "./repository";

/**
 * Speglar projekten mot Supabase.
 *
 * Webbläsarlagringen är kvar som snabb lokal kopia — den gör gränssnittet
 * omedelbart och gör att appen fungerar utan nät. Servern är källan mellan
 * enheter: vid start hämtas det som ligger där, och varje ändring skickas upp.
 *
 * Är Supabase inte konfigurerat händer ingenting av detta, och appen beter
 * sig precis som förut med enbart lokal lagring.
 */
export type StorageMode = "unknown" | "cloud" | "local";

interface ProjectsResponse {
  configured: boolean;
  projects?: PropertyProject[];
  error?: string;
}

export class CloudSync {
  private mode: StorageMode = "unknown";
  private lastError: string | null = null;

  getMode(): StorageMode {
    return this.mode;
  }

  /** Sista felet från molnet, för att kunna säga det i gränssnittet. */
  getLastError(): string | null {
    return this.lastError;
  }

  /**
   * Hämtar molnets projekt vid start. Finns inget där uppe men lokalt, laddas
   * det lokala upp så att första enheten inte tappar sitt arbete.
   *
   * Svarar servern med ett fel — fel nyckel, tabellen saknas — räknas läget
   * som lokalt. Att visa "sparas i molnet" när ingenting sparas vore värre
   * än att inte ha molnlagring alls.
   */
  async hydrate(local: LocalStorageProjectRepository): Promise<PropertyProject[] | null> {
    let response: Response;
    let data: ProjectsResponse;
    try {
      response = await fetch("/api/projects", { cache: "no-store" });
      data = (await response.json()) as ProjectsResponse;
    } catch {
      this.mode = "local";
      return null;
    }

    if (!response.ok || data.error) {
      this.mode = "local";
      this.lastError = data.error ?? `Servern svarade ${response.status}.`;
      return null;
    }

    if (!data.configured) {
      this.mode = "local";
      return null;
    }

    this.mode = "cloud";
    const remote = data.projects ?? [];

    if (remote.length === 0) {
      const localProjects = await local.list();
      for (const project of localProjects) await this.push(project);
      return localProjects.length > 0 ? localProjects : [];
    }

    return remote;
  }

  async push(project: PropertyProject): Promise<void> {
    if (this.mode !== "cloud") return;
    try {
      const response = await fetch("/api/projects", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ project }),
      });
      this.noteResult(response);
    } catch {
      // Nätet kan vara nere. Den lokala kopian är redan skriven, och nästa
      // ändring skickar upp projektet igen.
      this.lastError = "Ingen kontakt med servern — ändringen finns bara lokalt.";
    }
  }

  async remove(id: string): Promise<void> {
    if (this.mode !== "cloud") return;
    try {
      const response = await fetch(`/api/projects?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      this.noteResult(response);
    } catch {
      this.lastError = "Ingen kontakt med servern — borttagningen gäller bara lokalt.";
    }
  }

  private noteResult(response: Response): void {
    this.lastError = response.ok ? null : `Servern svarade ${response.status}.`;
  }
}
