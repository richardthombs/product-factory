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
      eventCount: 42,
      capabilityCount: 2,
      featureCount: 8,
      requirementCount: 8,
      acceptanceCriterionCount: 11,
      testCount: 12,
      lastEventId: "EVT-20260531-0042",
      lastOccurredAt: "2026-05-31T10:10:00.000Z",
    });

    const productYaml = await readFile(path.join(modelRoot, "product.yaml"), "utf8");
    expect(productYaml).toContain("id: PROD-001");
    expect(productYaml).toContain("tests: 12");

    const projectMarkdown = await readFile(path.join(modelRoot, "project.md"), "utf8");
    expect(projectMarkdown).toContain("# Product Factory");
    expect(projectMarkdown).toContain("### FEAT-006 — Rebuild product model");

    const traceabilityMatrix = await readFile(path.join(modelRoot, "indexes", "traceability-matrix.yaml"), "utf8");
    expect(traceabilityMatrix).toContain("acceptance_criterion_id: AC-007");
    expect(traceabilityMatrix).toContain("- TEST-012");
  });
});

