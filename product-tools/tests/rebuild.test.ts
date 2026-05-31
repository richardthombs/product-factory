import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { rebuildModel } from "../src/commands/rebuildModel.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("rebuildModel", () => {
// AC: AC-007
  it("validates events and regenerates the product model successfully", async () => {
    const eventsRoot = path.resolve(process.cwd(), "product-events");
    const modelRoot = await mkdtemp(path.join(os.tmpdir(), "rebuild-model-"));
    tempDirs.push(modelRoot);

    const summary = await rebuildModel(eventsRoot, modelRoot);

    expect(summary).toEqual({
      eventCount: 60,
      capabilityCount: 2,
      featureCount: 11,
      requirementCount: 11,
      acceptanceCriterionCount: 17,
      testCount: 18,
      lastEventId: "EVT-20260531-0060",
      lastOccurredAt: "2026-05-31T10:28:00.000Z",
    });

    const productYaml = await readFile(path.join(modelRoot, "product.yaml"), "utf8");
    expect(productYaml).toContain("id: PROD-001");
    expect(productYaml).toContain("tests: 18");

    const projectMarkdown = await readFile(path.join(modelRoot, "project.md"), "utf8");
    expect(projectMarkdown).toContain("# Product Factory");
    expect(projectMarkdown).toContain("### FEAT-006 — Rebuild product model");
    expect(projectMarkdown).toContain("### FEAT-009 — Change existing requirements and acceptance criteria");
    expect(projectMarkdown).toContain("### FEAT-011 — Track capability and feature readiness");

    const traceabilityMatrix = await readFile(path.join(modelRoot, "indexes", "traceability-matrix.yaml"), "utf8");
    expect(traceabilityMatrix).toContain("acceptance_criterion_id: AC-007");
    expect(traceabilityMatrix).toContain("acceptance_criterion_id: AC-013");
    expect(traceabilityMatrix).toContain("acceptance_criterion_id: AC-017");
    expect(traceabilityMatrix).toContain("- TEST-012");
    expect(traceabilityMatrix).toContain("- TEST-014");
    expect(traceabilityMatrix).toContain("- TEST-018");
  });
});

