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
import { LocalStorageProjectRepository } from "./repository";
import type { ImportReport } from "./schema";

export type SaveState = "saved" | "unsaved" | "saving";

interface ProjectStore {
  projects: PropertyProject[];
  loading: boolean;
  saveState: SaveState;
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
      const list = await repo.list();
      if (!cancelled) {
        setProjects(list);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [repo]);

  const flush = useCallback(async () => {
    if (pending.current.size === 0) return;
    setSaveState("saving");
    const entries = [...pending.current.values()];
    pending.current.clear();
    for (const project of entries) {
      await repo.update(project.id, project);
    }
    await reload();
    setSaveState("saved");
  }, [repo, reload]);

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
    reload,
    createBlank: async (name) => {
      const created = await repo.createBlank(name);
      await reload();
      return created;
    },
    getProject: (id) => projects.find((p) => p.id === id),
    updateProject,
    saveNow: flush,
    duplicate: async (id, name) => {
      const copy = await repo.duplicate(id, name);
      await reload();
      return copy;
    },
    remove: async (id) => {
      await repo.delete(id);
      await reload();
    },
    archive: async (id) => {
      await repo.archive(id);
      await reload();
    },
    restore: async (id) => {
      await repo.restore(id);
      await reload();
    },
    exportProjects: (ids) => repo.export(ids),
    importProjects: async (payload) => {
      const { report } = await repo.import(payload);
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
