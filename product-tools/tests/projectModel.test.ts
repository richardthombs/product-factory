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
    expect(productYaml).toContain("# Generated from /product-events.");
    expect(productYaml).toContain("id: PROD-001");
    expect(productYaml).toContain("capability_ids:");
    expect(productYaml).toContain("- CAP-001");
    expect(productYaml).toContain("- CAP-002");

    const projectMarkdown = await readFile(path.join(modelRoot, "project.md"), "utf8");
    expect(projectMarkdown).toContain("<!-- Generated from /product-events. -->");
    expect(projectMarkdown).toContain("# Product Factory");
    expect(projectMarkdown).toContain("# Summary");
    expect(projectMarkdown).toContain("- Tests: 12");
    expect(projectMarkdown).toContain("## CAP-001 — Manage product model structure");
    expect(projectMarkdown).toContain("### FEAT-008 — Create requirement");
    expect(projectMarkdown).toContain("**AC-011**");
    expect(projectMarkdown).toContain("TEST-010: product-tools/tests/createRequirement.test.ts — allocates ids automatically and creates acceptance criteria for an existing feature");
    expect(projectMarkdown).toContain("TEST-012: product-tools/tests/rebuild.test.ts — validates events and regenerates the product model successfully");

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
      "FEAT-008-create-requirement.yaml",
    ]);

    const traceabilityMatrix = await readFile(path.join(modelRoot, "indexes", "traceability-matrix.yaml"), "utf8");
    expect(traceabilityMatrix).toContain("capability_id: CAP-001");
    expect(traceabilityMatrix).toContain("capability_id: CAP-002");
    expect(traceabilityMatrix).toContain("feature_id: FEAT-003");
    expect(traceabilityMatrix).toContain("feature_id: FEAT-008");
    expect(traceabilityMatrix).toContain("requirement_id: REQ-008");
    expect(traceabilityMatrix).toContain("acceptance_criterion_id: AC-007");
    expect(traceabilityMatrix).toContain("acceptance_criterion_id: AC-011");
    expect(traceabilityMatrix).toContain("- TEST-012");
    expect(traceabilityMatrix).toContain("- TEST-011");

    const testsIndex = await readFile(path.join(modelRoot, "indexes", "tests.yaml"), "utf8");
    expect(testsIndex).toContain("id: TEST-012");
    expect(testsIndex).toContain("test_count: 12");

    const testFile = await readFile(path.join(modelRoot, "tests", "TEST-012.yaml"), "utf8");
    expect(testFile).toContain("acceptance_criterion_id: AC-007");
    expect(testFile).not.toContain("line_number:");
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


