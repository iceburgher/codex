import { beforeEach, describe, expect, it } from "vitest";
import { LocalStorageProjectRepository } from "@/lib/repository";
import { createSeedProject, SEED_PROJECT_ID } from "@/data/seedProject";
import { createBlankProject } from "@/lib/defaults";

describe("project repository", () => {
  let repo: LocalStorageProjectRepository;

  beforeEach(() => {
    window.localStorage.clear();
    repo = new LocalStorageProjectRepository();
  });

  it("persists a project across repository instances", async () => {
    const created = await repo.create(createBlankProject("a", "Project A"));
    const reopened = await new LocalStorageProjectRepository().get(created.id);
    expect(reopened?.name).toBe("Project A");
  });

  it("duplicates without sharing mutable state", async () => {
    const a = await repo.create(createBlankProject("a", "Project A"));
    const b = await repo.duplicate(a.id, "Project B");

    b.inputs.purchasePrice = 9_000_000;
    b.scenarios.PRIVATE_DEBT.privateLoans.mortgageAmount = 1_000_000;
    await repo.update(b.id, b);

    const reloadedA = await repo.get(a.id);
    expect(reloadedA?.inputs.purchasePrice).toBeNull();
    expect(reloadedA?.scenarios.PRIVATE_DEBT.privateLoans.mortgageAmount).toBe(0);
    expect(b.id).not.toBe(a.id);
  });

  it("deleting one project leaves the other intact", async () => {
    const a = await repo.create(createBlankProject("a", "Project A"));
    const b = await repo.duplicate(a.id, "Project B");
    await repo.delete(a.id);

    expect(await repo.get(a.id)).toBeNull();
    expect((await repo.get(b.id))?.name).toBe("Project B");
  });

  it("archives and restores without deleting", async () => {
    const a = await repo.create(createBlankProject("a", "Project A"));
    await repo.archive(a.id);
    expect((await repo.get(a.id))?.archived).toBe(true);
    await repo.restore(a.id);
    expect((await repo.get(a.id))?.archived).toBe(false);
  });

  it("round-trips an export through import as a separate project", async () => {
    const a = await repo.create(createBlankProject("a", "Project A"));
    a.inputs.purchasePrice = 3_600_000;
    await repo.update(a.id, a);

    const json = await repo.export([a.id]);
    const { projects, report } = await repo.import(JSON.parse(json));

    expect(report.imported).toBe(1);
    expect(projects[0].id).not.toBe(a.id);
    expect(projects[0].inputs.purchasePrice).toBe(3_600_000);
    expect(report.issues.some((i) => i.path === "id")).toBe(true);
    expect((await repo.list()).length).toBe(2);
  });

  it("reports validation errors instead of silently importing garbage", async () => {
    const { projects, report } = await repo.import({
      schemaVersion: 1,
      projects: [{ id: "x", name: "Broken" }],
    });
    expect(projects).toHaveLength(0);
    expect(report.imported).toBe(0);
    expect(report.issues.some((i) => i.severity === "error")).toBe(true);
  });

  it("preserves explicit nulls and reports them as missing", async () => {
    const a = createBlankProject("a", "Project A");
    const json = JSON.stringify({ schemaVersion: 1, projects: [a] });
    const { projects, report } = await repo.import(JSON.parse(json));
    expect(projects[0].inputs.expectedSalePrice).toBeNull();
    expect(
      report.issues.some(
        (i) => i.path === "inputs.expectedSalePrice" && i.severity === "warning",
      ),
    ).toBe(true);
  });

  it("creates the starter project only on first launch", async () => {
    await repo.ensureSeed();
    expect((await repo.list()).map((p) => p.id)).toContain(SEED_PROJECT_ID);

    await repo.delete(SEED_PROJECT_ID);
    await repo.ensureSeed();
    expect((await repo.list()).map((p) => p.id)).not.toContain(SEED_PROJECT_ID);
  });

  it("keeps tax-sensitive inputs isolated between projects", async () => {
    const a = await repo.create(createBlankProject("a", "A"));
    const b = await repo.create(createBlankProject("b", "B"));

    a.taxOverrides = { corporateTaxRate: 0.15 };
    await repo.update(a.id, a);

    expect((await repo.get(b.id))?.taxOverrides).toEqual({});
  });
});

describe("seed project", () => {
  it("keeps unknown values as null rather than guessing", () => {
    const seed = createSeedProject();
    expect(seed.inputs.purchasePrice).toBe(3_600_000);
    expect(seed.inputs.expectedSalePrice).toBeNull();
    expect(seed.inputs.priorYearTaxAssessmentValue).toBeNull();
    expect(seed.inputs.existingMortgageDeeds).toBeNull();
  });

  it("carries the known renovation budget and contingency", () => {
    const seed = createSeedProject();
    expect(seed.renovation.other).toBe(1_000_000);
    expect(seed.renovation.inspection).toBe(5_000);
    expect(seed.renovation.contingencyPercent).toBe(0.15);
  });

  it("defaults VAT deduction to zero", () => {
    const seed = createSeedProject();
    expect(seed.scenarios.EXISTING_COMPANY.vat.vatDeductiblePercent).toBe(0);
  });

  it("fills in an illustrative improvement-basis split for the private scenarios", () => {
    // Otherwise the demo shows a private capital gains tax bill computed as
    // if none of the 1 MSEK renovation budget were deductible, which reads
    // as a broken calculation rather than the flip-classification risk it's
    // meant to illustrate.
    for (const type of ["PRIVATE_EQUITY", "PRIVATE_DEBT"] as const) {
      const seed = createSeedProject();
      const split = seed.scenarios[type].improvementBasis;
      expect(
        split.fundamentalImprovementsPercent +
          split.qualifyingRepairsAndMaintenancePercent +
          split.nonDeductiblePercent,
      ).toBeCloseTo(1, 6);
      expect(split.nonDeductiblePercent).toBeLessThan(1);
    }
  });
});
