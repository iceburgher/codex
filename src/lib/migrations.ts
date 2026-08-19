import type { PropertyProject } from "@/types";
import {
  ALL_SCENARIOS,
  SCHEMA_VERSION,
  createBlankProject,
  defaultHiddenCosts,
  defaultScenario,
} from "./defaults";

type Migration = (project: Record<string, unknown>) => Record<string, unknown>;

/**
 * Version-to-version migrations. Unknown fields are carried through rather
 * than dropped, so a newer file opened by an older build loses nothing on
 * re-export.
 */
const migrations: Record<number, Migration> = {
  // 0 -> 1: pre-versioned files simply get stamped.
  0: (p) => ({ ...p, schemaVersion: 1 }),
};

/**
 * Brings a stored/imported project up to the current schema and fills any
 * structurally required field that a partial file omitted. Economic values are
 * never invented: money fields the file left out stay null/zero as defined by
 * the blank project.
 */
export function migrateProject(raw: Record<string, unknown>): PropertyProject {
  let working = { ...raw };
  let version = typeof working.schemaVersion === "number" ? working.schemaVersion : 0;

  while (version < SCHEMA_VERSION && migrations[version]) {
    working = migrations[version](working);
    version = typeof working.schemaVersion === "number" ? working.schemaVersion : version + 1;
  }

  const id = typeof working.id === "string" ? working.id : `p-${Date.now()}`;
  const skeleton = createBlankProject(id, typeof working.name === "string" ? working.name : "Importerat projekt");

  const merged: PropertyProject = {
    ...skeleton,
    ...(working as unknown as PropertyProject),
    schemaVersion: SCHEMA_VERSION,
    id,
    facts: { ...skeleton.facts, ...(working.facts as object) },
    inputs: { ...skeleton.inputs, ...(working.inputs as object) },
    renovation: { ...skeleton.renovation, ...(working.renovation as object) },
    operatingCosts: { ...skeleton.operatingCosts, ...(working.operatingCosts as object) },
    rental: { ...skeleton.rental, ...(working.rental as object) },
    sale: { ...skeleton.sale, ...(working.sale as object) },
    hiddenCosts: Array.isArray(working.hiddenCosts)
      ? (working.hiddenCosts as PropertyProject["hiddenCosts"])
      : defaultHiddenCosts(),
    aiChat: Array.isArray(working.aiChat) ? (working.aiChat as PropertyProject["aiChat"]) : [],
    scenarios: { ...skeleton.scenarios },
    taxOverrides: (working.taxOverrides as PropertyProject["taxOverrides"]) ?? {},
    taxConfigSnapshot:
      (working.taxConfigSnapshot as PropertyProject["taxConfigSnapshot"]) ?? null,
  };

  const rawScenarios = (working.scenarios ?? {}) as Record<string, unknown>;
  for (const type of ALL_SCENARIOS) {
    const base = defaultScenario(type);
    const incoming = rawScenarios[type] as Record<string, unknown> | undefined;
    merged.scenarios[type] = incoming
      ? {
          ...base,
          ...(incoming as object),
          privateFunding: { ...base.privateFunding, ...(incoming.privateFunding as object) },
          privateLoans: { ...base.privateLoans, ...(incoming.privateLoans as object) },
          dividend: { ...base.dividend, ...(incoming.dividend as object) },
          salary: { ...base.salary, ...(incoming.salary as object) },
          companyFunding: { ...base.companyFunding, ...(incoming.companyFunding as object) },
          vat: { ...base.vat, ...(incoming.vat as object) },
          rot: { ...base.rot, ...(incoming.rot as object) },
          benefit: { ...base.benefit, ...(incoming.benefit as object) },
          improvementBasis: { ...base.improvementBasis, ...(incoming.improvementBasis as object) },
          opportunityCost: { ...base.opportunityCost, ...(incoming.opportunityCost as object) },
        }
      : base;
  }

  // A file exported before a scenario type was retired (e.g. the separate
  // project company) can still name it here. Drop what no longer exists
  // rather than let the UI try to render a scenario with no data behind it.
  if (Array.isArray(merged.compareScenarios)) {
    merged.compareScenarios = merged.compareScenarios.filter((s) =>
      (ALL_SCENARIOS as string[]).includes(s),
    );
  }
  if (!Array.isArray(merged.compareScenarios) || merged.compareScenarios.length === 0) {
    merged.compareScenarios = [...ALL_SCENARIOS];
  }
  if (!(ALL_SCENARIOS as string[]).includes(merged.selectedScenario)) {
    merged.selectedScenario = merged.compareScenarios[0];
  }

  return merged;
}
