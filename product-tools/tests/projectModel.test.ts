import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { projectModel } from "../src/projection/projectModel.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("projectModel", () => {
// AC: AC-006, AC-009
  it("projects the current self-described event stream into deterministic YAML files", async () => {
    const eventsRoot = path.resolve(process.cwd(), "product-events");
    const modelRoot = await mkdtemp(path.join(os.tmpdir(), "product-model-"));
    tempDirs.push(modelRoot);

    const summary = await projectModel(eventsRoot, modelRoot);

    expect(summary).toEqual({
      eventCount: 35,
      capabilityCount: 2,
      featureCount: 7,
      requirementCount: 7,
      acceptanceCriterionCount: 9,
      testCount: 9,
      lastEventId: "EVT-20260531-0035",
      lastOccurredAt: "2026-05-31T09:56:00.000Z",
    });

    const productYaml = await readFile(path.join(modelRoot, "product.yaml"), "utf8");
    expect(productYaml).toContain("# Generated from /product-events.");
    expect(productYaml).toContain("id: PROD-001");
    expect(productYaml).toContain("capability_ids:");
    expect(productYaml).toContain("- CAP-001");
    expect(productYaml).toContain("- CAP-002");

    const projectMarkdown = await readFile(path.join(modelRoot, "project.md"), "utf8");
    expect(projectMarkdown).toContain("<!-- Generated from /product-events. -->");
    expect(projectMarkdown).toContain("# Product Factory");
    expect(projectMarkdown).toContain("# Summary");
    expect(projectMarkdown).toContain("- Tests: 9");
    expect(projectMarkdown).toContain("## CAP-001 — Manage product model structure");
    expect(projectMarkdown).toContain("### FEAT-007 — Create tests for acceptance criteria");
    expect(projectMarkdown).toContain("**AC-009**");
    expect(projectMarkdown).toContain("TEST-006: product-tools/tests/projectModel.test.ts:15");

    const capabilityFiles = await readdir(path.join(modelRoot, "capabilities"));
    expect(capabilityFiles).toEqual([
      "CAP-001-manage-product-model-structure.yaml",
      "CAP-002-validate-and-project-product-model.yaml",
    ]);

    const featureFiles = await readdir(path.join(modelRoot, "features"));
    expect(featureFiles).toEqual([
      "FEAT-001-create-initial-product.yaml",
      "FEAT-002-create-capability.yaml",
      "FEAT-003-create-feature-with-requirements-and-acceptance-criteria.yaml",
      "FEAT-004-validate-product-events.yaml",
      "FEAT-005-project-current-state-product-model.yaml",
      "FEAT-006-rebuild-product-model.yaml",
      "FEAT-007-create-tests-for-acceptance-criteria.yaml",
    ]);

    const traceabilityMatrix = await readFile(path.join(modelRoot, "indexes", "traceability-matrix.yaml"), "utf8");
    expect(traceabilityMatrix).toContain("capability_id: CAP-001");
    expect(traceabilityMatrix).toContain("capability_id: CAP-002");
    expect(traceabilityMatrix).toContain("feature_id: FEAT-003");
    expect(traceabilityMatrix).toContain("feature_id: FEAT-007");
    expect(traceabilityMatrix).toContain("requirement_id: REQ-007");
    expect(traceabilityMatrix).toContain("acceptance_criterion_id: AC-004");
    expect(traceabilityMatrix).toContain("acceptance_criterion_id: AC-009");
    expect(traceabilityMatrix).toContain("- TEST-004");
    expect(traceabilityMatrix).toContain("- TEST-007");

    const testsIndex = await readFile(path.join(modelRoot, "indexes", "tests.yaml"), "utf8");
    expect(testsIndex).toContain("id: TEST-009");
    expect(testsIndex).toContain("test_count: 9");

    const testFile = await readFile(path.join(modelRoot, "tests", "TEST-006.yaml"), "utf8");
    expect(testFile).toContain("acceptance_criterion_id: AC-006");
    expect(testFile).toContain("line_number: 15");
  });

// AC: AC-006
  it("produces identical output across repeated rebuilds", async () => {
    const eventsRoot = path.resolve(process.cwd(), "product-events");
    const firstModelRoot = await mkdtemp(path.join(os.tmpdir(), "product-model-first-"));
    const secondModelRoot = await mkdtemp(path.join(os.tmpdir(), "product-model-second-"));
    tempDirs.push(firstModelRoot, secondModelRoot);

    await projectModel(eventsRoot, firstModelRoot);
    await projectModel(eventsRoot, secondModelRoot);

    const firstTraceabilityMatrix = await readFile(
      path.join(firstModelRoot, "indexes", "traceability-matrix.yaml"),
      "utf8",
    );
    const secondTraceabilityMatrix = await readFile(
      path.join(secondModelRoot, "indexes", "traceability-matrix.yaml"),
      "utf8",
    );
    const firstProjectMarkdown = await readFile(path.join(firstModelRoot, "project.md"), "utf8");
    const secondProjectMarkdown = await readFile(path.join(secondModelRoot, "project.md"), "utf8");

    expect(secondTraceabilityMatrix).toEqual(firstTraceabilityMatrix);
    expect(secondProjectMarkdown).toEqual(firstProjectMarkdown);
  });
});


