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

  getMode(): StorageMode {
    return this.mode;
  }

  /**
   * Hämtar molnets projekt vid start. Finns inget där uppe men lokalt, laddas
   * det lokala upp så att första enheten inte tappar sitt arbete.
   */
  async hydrate(local: LocalStorageProjectRepository): Promise<PropertyProject[] | null> {
    let data: ProjectsResponse;
    try {
      const response = await fetch("/api/projects", { cache: "no-store" });
      data = (await response.json()) as ProjectsResponse;
    } catch {
      this.mode = "local";
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
      await Promise.all(localProjects.map((p) => this.push(p)));
      return localProjects.length > 0 ? localProjects : [];
    }

    return remote;
  }

  async push(project: PropertyProject): Promise<void> {
    if (this.mode === "local") return;
    try {
      await fetch("/api/projects", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ project }),
      });
    } catch {
      // Nätet kan vara nere. Den lokala kopian är redan skriven, och nästa
      // ändring skickar upp projektet igen.
    }
  }

  async remove(id: string): Promise<void> {
    if (this.mode === "local") return;
    try {
      await fetch(`/api/projects?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    } catch {
      // Se kommentaren i push.
    }
  }
}
