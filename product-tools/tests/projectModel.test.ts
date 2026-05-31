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
    expect(productYaml).toContain("# Generated from /product-events.");
    expect(productYaml).toContain("id: PROD-001");
    expect(productYaml).toContain("capability_ids:");
    expect(productYaml).toContain("- CAP-001");
    expect(productYaml).toContain("- CAP-002");

    const projectMarkdown = await readFile(path.join(modelRoot, "project.md"), "utf8");
    expect(projectMarkdown).toContain("<!-- Generated from /product-events. -->");
    expect(projectMarkdown).toContain("# Product Factory");
    expect(projectMarkdown).toContain("# Summary");
    expect(projectMarkdown).toContain("- Tests: 18");
    expect(projectMarkdown).toContain("## CAP-001 — Manage product model structure");
    expect(projectMarkdown).toContain("### FEAT-008 — Create requirement");
    expect(projectMarkdown).toContain("### FEAT-009 — Change existing requirements and acceptance criteria");
    expect(projectMarkdown).toContain("### FEAT-010 — Reshape feature structure");
    expect(projectMarkdown).toContain("### FEAT-011 — Track capability and feature readiness");
    expect(projectMarkdown).toContain("**AC-006**: Given a valid event stream, when project-model is run, then the system generates deterministic YAML files for the product, capabilities, features, requirements, acceptance criteria, and indexes. `TEST-006`, `TEST-008`.");
    expect(projectMarkdown).toContain("**AC-011**: Given an existing feature, when the create-requirement helper is run with multiple acceptance criteria, then the new requirement is projected under the feature with all created acceptance criteria. `TEST-011`.");
    expect(projectMarkdown).toContain("**AC-012**: Given an existing requirement, when the change-requirement helper is run with a new description, then the system records a RequirementChanged event and projects the updated requirement description. `TEST-013`.");
    expect(projectMarkdown).toContain("**AC-013**: Given an existing acceptance criterion, when the change-acceptance-criterion helper is run with new text, then the system records an AcceptanceCriterionChanged event and projects the updated acceptance criterion text. `TEST-014`.");
    expect(projectMarkdown).toContain("**AC-014**: Given an existing feature and a target capability, when the move-feature helper is run, then the system records a FeatureMovedToCapability event and projects the feature under the target capability. `TEST-015`.");
    expect(projectMarkdown).toContain("**AC-015**: Given an existing feature, when the deprecate-feature helper is run with a reason, then the system records a FeatureDeprecated event and projects the feature as deprecated with its deprecation reason. `TEST-016`.");
    expect(projectMarkdown).toContain("**AC-016**: Given an existing feature, when the set-feature-status helper is run with a new status, then the system records a FeatureStatusChanged event and projects the updated feature readiness state. `TEST-017`.");
    expect(projectMarkdown).toContain("**AC-017**: Given an existing capability, when the set-capability-status helper is run with a new status, then the system records a CapabilityStatusChanged event and projects the updated capability readiness state. `TEST-018`.");
    expect(projectMarkdown).toContain("**AC-007**: Given a valid event stream, when rebuild is run, then the system validates events and regenerates the product model successfully. `TEST-012`.");
    expect(projectMarkdown).not.toContain("product-tools/tests/createRequirement.test.ts");
    expect(projectMarkdown).not.toContain("product-tools/tests/rebuild.test.ts");
    expect(projectMarkdown).not.toContain("      - Tests:");

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
      "FEAT-009-change-existing-requirements-and-acceptance-criteria.yaml",
      "FEAT-010-reshape-feature-structure.yaml",
      "FEAT-011-track-capability-and-feature-readiness.yaml",
    ]);

    const traceabilityMatrix = await readFile(path.join(modelRoot, "indexes", "traceability-matrix.yaml"), "utf8");
    expect(traceabilityMatrix).toContain("capability_id: CAP-001");
    expect(traceabilityMatrix).toContain("capability_id: CAP-002");
    expect(traceabilityMatrix).toContain("feature_id: FEAT-003");
    expect(traceabilityMatrix).toContain("feature_id: FEAT-008");
    expect(traceabilityMatrix).toContain("feature_id: FEAT-009");
    expect(traceabilityMatrix).toContain("feature_id: FEAT-010");
    expect(traceabilityMatrix).toContain("feature_id: FEAT-011");
    expect(traceabilityMatrix).toContain("requirement_id: REQ-008");
    expect(traceabilityMatrix).toContain("requirement_id: REQ-009");
    expect(traceabilityMatrix).toContain("requirement_id: REQ-011");
    expect(traceabilityMatrix).toContain("acceptance_criterion_id: AC-007");
    expect(traceabilityMatrix).toContain("acceptance_criterion_id: AC-011");
    expect(traceabilityMatrix).toContain("acceptance_criterion_id: AC-013");
    expect(traceabilityMatrix).toContain("acceptance_criterion_id: AC-017");
    expect(traceabilityMatrix).toContain("- TEST-012");
    expect(traceabilityMatrix).toContain("- TEST-011");
    expect(traceabilityMatrix).toContain("- TEST-014");
    expect(traceabilityMatrix).toContain("- TEST-018");

    const testsIndex = await readFile(path.join(modelRoot, "indexes", "tests.yaml"), "utf8");
    expect(testsIndex).toContain("id: TEST-012");
    expect(testsIndex).toContain("id: TEST-014");
    expect(testsIndex).toContain("id: TEST-018");
    expect(testsIndex).toContain("test_count: 18");

    const readinessIndex = await readFile(path.join(modelRoot, "indexes", "readiness.yaml"), "utf8");
    expect(readinessIndex).toContain("implementation_ready_features: []");
    expect(readinessIndex).toContain("feature_id: FEAT-011");

    const testFile = await readFile(path.join(modelRoot, "tests", "TEST-018.yaml"), "utf8");
    expect(testFile).toContain("acceptance_criterion_id: AC-017");
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


