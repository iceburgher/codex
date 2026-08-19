"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { PropertyProject } from "@/types";
import { CloudSync, type StorageMode } from "./cloudSync";
import { LocalStorageProjectRepository } from "./repository";
import type { ImportReport } from "./schema";

export type SaveState = "saved" | "unsaved" | "saving";

interface ProjectStore {
  projects: PropertyProject[];
  loading: boolean;
  saveState: SaveState;
  /** Var projekten faktiskt hamnar — molnet eller bara den här webbläsaren. */
  storageMode: StorageMode;
  /** Satt när molnet svarat med fel, så att gränssnittet kan säga det. */
  storageError: string | null;
  reload: () => Promise<void>;
  createBlank: (name?: string) => Promise<PropertyProject>;
  getProject: (id: string) => PropertyProject | undefined;
  updateProject: (project: PropertyProject) => void;
  saveNow: () => Promise<void>;
  duplicate: (id: string, name?: string) => Promise<PropertyProject>;
  remove: (id: string) => Promise<void>;
  archive: (id: string) => Promise<void>;
  restore: (id: string) => Promise<void>;
  exportProjects: (ids: string[]) => Promise<string>;
  importProjects: (payload: unknown) => Promise<ImportReport>;
}

const ProjectStoreContext = createContext<ProjectStore | null>(null);

const AUTOSAVE_DEBOUNCE_MS = 600;

export function ProjectStoreProvider({ children }: { children: ReactNode }) {
  const repo = useMemo(() => new LocalStorageProjectRepository(), []);
  const cloud = useMemo(() => new CloudSync(), []);
  const [storageMode, setStorageMode] = useState<StorageMode>("unknown");
  const [storageError, setStorageError] = useState<string | null>(null);
  const [projects, setProjects] = useState<PropertyProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const pending = useRef<Map<string, PropertyProject>>(new Map());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reload = useCallback(async () => {
    const list = await repo.list();
    setProjects(list);
  }, [repo]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await repo.ensureSeed();

      // Molnet går före: har en annan enhet sparat något är det den bilden
      // som gäller, och den skrivs ned lokalt som snabb kopia.
      const remote = await cloud.hydrate(repo);
      if (remote !== null) {
        await repo.replaceAll(remote);
      }

      const list = await repo.list();
      if (!cancelled) {
        setProjects(list);
        setStorageMode(cloud.getMode());
        setStorageError(cloud.getLastError());
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [repo, cloud]);

  const flush = useCallback(async () => {
    if (pending.current.size === 0) return;
    setSaveState("saving");
    const entries = [...pending.current.values()];
    pending.current.clear();
    for (const project of entries) {
      const stored = await repo.update(project.id, project);
      await cloud.push(stored);
    }
    await reload();
    setStorageError(cloud.getLastError());
    setSaveState("saved");
  }, [repo, reload, cloud]);

  const updateProject = useCallback(
    (project: PropertyProject) => {
      const stamped = { ...project, updatedAt: new Date().toISOString() };
      setProjects((prev) => prev.map((p) => (p.id === stamped.id ? stamped : p)));
      pending.current.set(stamped.id, stamped);
      setSaveState("unsaved");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void flush();
      }, AUTOSAVE_DEBOUNCE_MS);
    },
    [flush],
  );

  // Never lose edits queued when the tab closes mid-debounce.
  useEffect(() => {
    const handler = () => {
      if (pending.current.size > 0) void flush();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [flush]);

  const value: ProjectStore = {
    projects,
    loading,
    saveState,
    storageMode,
    storageError,
    reload,
    createBlank: async (name) => {
      const created = await repo.createBlank(name);
      await cloud.push(created);
      await reload();
      return created;
    },
    getProject: (id) => projects.find((p) => p.id === id),
    updateProject,
    saveNow: flush,
    duplicate: async (id, name) => {
      const copy = await repo.duplicate(id, name);
      await cloud.push(copy);
      await reload();
      return copy;
    },
    remove: async (id) => {
      await repo.delete(id);
      await cloud.remove(id);
      await reload();
    },
    archive: async (id) => {
      await repo.archive(id);
      const archived = await repo.get(id);
      if (archived) await cloud.push(archived);
      await reload();
    },
    restore: async (id) => {
      await repo.restore(id);
      const restored = await repo.get(id);
      if (restored) await cloud.push(restored);
      await reload();
    },
    exportProjects: (ids) => repo.export(ids),
    importProjects: async (payload) => {
      const { projects: imported, report } = await repo.import(payload);
      await Promise.all(imported.map((p) => cloud.push(p)));
      await reload();
      return report;
    },
  };

  return <ProjectStoreContext.Provider value={value}>{children}</ProjectStoreContext.Provider>;
}

export function useProjectStore(): ProjectStore {
  const ctx = useContext(ProjectStoreContext);
  if (!ctx) throw new Error("useProjectStore must be used inside ProjectStoreProvider");
  return ctx;
}
