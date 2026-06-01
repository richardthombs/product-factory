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
      eventCount: 126,
      capabilityCount: 2,
      featureCount: 15,
      requirementCount: 20,
      acceptanceCriterionCount: 34,
      testCount: 39,
      lastEventId: "EVT-20260601-0040",
      lastOccurredAt: "2026-06-01T09:26:30.000Z",
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
    expect(projectMarkdown).toContain("- Tests: 39");
    expect(projectMarkdown).toContain("## CAP-001 — Manage product model structure");
    expect(projectMarkdown).toContain("### FEAT-008 — Create requirement");
    expect(projectMarkdown).toContain("### FEAT-009 — Change existing requirements and acceptance criteria");
    expect(projectMarkdown).toContain("### FEAT-010 — Reshape feature structure");
    expect(projectMarkdown).toContain("### FEAT-011 — Track capability and feature readiness");
    expect(projectMarkdown).toContain("### FEAT-012 — Report branch delta");
    expect(projectMarkdown).toContain("Reports the net product delta between a working branch and a base branch.");
    expect(projectMarkdown).toContain("### FEAT-013 — Derive work packages from branch delta");
    expect(projectMarkdown).toContain("Derives deterministic implementation work packages from the net branch-delta report.");
    expect(projectMarkdown).toContain("### FEAT-014 — Change existing feature descriptions");
    expect(projectMarkdown).toContain("Updates existing feature descriptions incrementally as the product evolves.");
    expect(projectMarkdown).toContain("### FEAT-015 — Reconcile branch-only events");
    expect(projectMarkdown).toContain("Replays branch-only product events against the latest accepted entity state and reports stale or conflicting proposals before merge.");
    expect(projectMarkdown).toContain("**AC-006**: Given a valid event stream, when project-model is run, then the system generates deterministic YAML files for the product, capabilities, features, requirements, acceptance criteria, and indexes. `TEST-006`, `TEST-008`.");
    expect(projectMarkdown).toContain("**AC-011**: Given an existing feature, when the create-requirement helper is run with multiple acceptance criteria, then the new requirement is projected under the feature with all created acceptance criteria. `TEST-011`.");
    expect(projectMarkdown).toContain("**AC-012**: Given an existing requirement, when the change-requirement helper is run with a new description, then the system records a RequirementChanged event and projects the updated requirement description. `TEST-013`.");
    expect(projectMarkdown).toContain("**AC-013**: Given an existing acceptance criterion, when the change-acceptance-criterion helper is run with new text, then the system records an AcceptanceCriterionChanged event and projects the updated acceptance criterion text. `TEST-014`.");
    expect(projectMarkdown).toContain("**AC-014**: Given an existing feature and a target capability, when the move-feature helper is run, then the system records a FeatureMovedToCapability event and projects the feature under the target capability. `TEST-015`.");
    expect(projectMarkdown).toContain("**AC-015**: Given an existing feature, when the deprecate-feature helper is run with a reason, then the system records a FeatureDeprecated event and projects the feature as deprecated with its deprecation reason. `TEST-016`.");
    expect(projectMarkdown).toContain("**AC-016**: Given an existing feature, when the set-feature-status helper is run with a new status, then the system records a FeatureStatusChanged event and projects the updated feature readiness state. `TEST-017`.");
    expect(projectMarkdown).toContain("**AC-017**: Given an existing capability, when the set-capability-status helper is run with a new status, then the system records a CapabilityStatusChanged event and projects the updated capability readiness state. `TEST-018`.");
    expect(projectMarkdown).toContain("**AC-018**: Given a working branch with product events not contained in the base branch, when the branch-delta helper is run, then it reports the branch-only product events relative to the base branch. `TEST-019`.");
    expect(projectMarkdown).toContain("**AC-019**: Given a base branch that cannot be resolved, when the branch-delta helper is run, then it fails instead of emitting a trusted branch-delta report. `TEST-020`.");
    expect(projectMarkdown).toContain("**AC-020**: Given branch-only product events affecting capabilities, features, requirements, acceptance criteria, or tests, when the branch-delta helper is run, then it reports changed entities grouped by entity type and change kind based on their net difference from the base branch. `TEST-021`.");
    expect(projectMarkdown).toContain("**AC-021**: Given entities that are added and then further refined only on the working branch, when the branch-delta helper is run, then it reports them as added and infers change categories from the net branch delta rather than intermediate branch-only churn. `TEST-022`.");
    expect(projectMarkdown).toContain("**AC-022**: Given net changed entities in the branch delta, when the branch-delta helper is run, then it reports the impacted capabilities, features, requirements, acceptance criteria, and tests related to those changes. `TEST-023`, `TEST-024`.");
    expect(projectMarkdown).toContain("**AC-023**: Given a working branch and base branch, when the branch-delta helper is run without a custom output path, then it writes branch-delta/branch-delta.yaml and branch-delta/branch-delta.md as gitignored branch-local artifacts, and the markdown presents changed entities in parent context with explicit change labels. `TEST-025`, `TEST-026`.");
    expect(projectMarkdown).toContain("**AC-024**: Given a net branch delta with changed entities under one feature, when the derive-work-packages helper is run, then it emits a work-package proposal that groups that net changed scope under that feature. `TEST-027`.");
    expect(projectMarkdown).toContain("**AC-025**: Given a net branch delta with changed entities, when the derive-work-packages helper is run, then each derived work package includes its scoped capability, feature, requirement, acceptance-criterion, and test ids together with rationale and dependency information for that net changed scope. `TEST-028`.");
    expect(projectMarkdown).toContain("**AC-026**: Given an existing feature, when the change-feature helper is run with a new description, then the system records a FeatureChanged event and projects the updated feature description. `TEST-029`.");
    expect(projectMarkdown).toContain("**AC-027**: Given branch-only events whose concurrency preconditions match the latest accepted state, when the reconcile-events helper is run against a base branch, then it exits successfully without writing reconciliation artifacts and without producing stdout or stderr. `TEST-031`, `TEST-038`.");
    expect(projectMarkdown).toContain("**AC-030**: Given reconcile-events finds reconciliation conflicts and is run without a custom output path, when it completes, then it writes branch-delta/reconciliation.yaml and branch-delta/reconciliation.md as gitignored branch-local artifacts. `TEST-034`, `TEST-039`.");
    expect(projectMarkdown).toContain("**AC-031**: Given reconciliation against the latest target branch fails, when reconcile-events is run in local workflow or CI, then it exits non-zero so merge gating can block acceptance. `TEST-035`.");
    expect(projectMarkdown).toContain("**AC-032**: Given concurrency preconditions that reference existing entities and prior events affecting those same entities, when validate-events is run, then the event stream is accepted as valid structured concurrency metadata. `TEST-036`.");
    expect(projectMarkdown).toContain("**AC-033**: Given concurrency preconditions that reference missing entities or last-event ids that did not affect the referenced entity, when validate-events is run, then it reports validation errors. `TEST-037`.");
    expect(projectMarkdown).toContain("**AC-034**: Given accepted events affecting capabilities, features, requirements, acceptance criteria, or tests, when project-model is run, then the projected model includes deterministic derived revision metadata for those entities. `TEST-030`.");
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
      "FEAT-012-report-branch-delta.yaml",
      "FEAT-013-derive-work-packages-from-branch-delta.yaml",
      "FEAT-014-change-existing-feature-descriptions.yaml",
      "FEAT-015-reconcile-branch-only-events.yaml",
    ]);

    const traceabilityMatrix = await readFile(path.join(modelRoot, "indexes", "traceability-matrix.yaml"), "utf8");
    expect(traceabilityMatrix).toContain("capability_id: CAP-001");
    expect(traceabilityMatrix).toContain("capability_id: CAP-002");
    expect(traceabilityMatrix).toContain("feature_id: FEAT-003");
    expect(traceabilityMatrix).toContain("feature_id: FEAT-008");
    expect(traceabilityMatrix).toContain("feature_id: FEAT-009");
    expect(traceabilityMatrix).toContain("feature_id: FEAT-010");
    expect(traceabilityMatrix).toContain("feature_id: FEAT-011");
    expect(traceabilityMatrix).toContain("feature_id: FEAT-012");
    expect(traceabilityMatrix).toContain("requirement_id: REQ-008");
    expect(traceabilityMatrix).toContain("requirement_id: REQ-009");
    expect(traceabilityMatrix).toContain("requirement_id: REQ-011");
    expect(traceabilityMatrix).toContain("requirement_id: REQ-012");
    expect(traceabilityMatrix).toContain("requirement_id: REQ-013");
    expect(traceabilityMatrix).toContain("requirement_id: REQ-014");
    expect(traceabilityMatrix).toContain("requirement_id: REQ-015");
    expect(traceabilityMatrix).toContain("requirement_id: REQ-016");
    expect(traceabilityMatrix).toContain("requirement_id: REQ-020");
    expect(traceabilityMatrix).toContain("acceptance_criterion_id: AC-007");
    expect(traceabilityMatrix).toContain("acceptance_criterion_id: AC-011");
    expect(traceabilityMatrix).toContain("acceptance_criterion_id: AC-013");
    expect(traceabilityMatrix).toContain("acceptance_criterion_id: AC-017");
    expect(traceabilityMatrix).toContain("acceptance_criterion_id: AC-019");
    expect(traceabilityMatrix).toContain("acceptance_criterion_id: AC-021");
    expect(traceabilityMatrix).toContain("acceptance_criterion_id: AC-023");
    expect(traceabilityMatrix).toContain("acceptance_criterion_id: AC-024");
    expect(traceabilityMatrix).toContain("acceptance_criterion_id: AC-025");
    expect(traceabilityMatrix).toContain("acceptance_criterion_id: AC-026");
    expect(traceabilityMatrix).toContain("acceptance_criterion_id: AC-034");
    expect(traceabilityMatrix).toContain("- TEST-012");
    expect(traceabilityMatrix).toContain("- TEST-011");
    expect(traceabilityMatrix).toContain("- TEST-014");
    expect(traceabilityMatrix).toContain("- TEST-018");
    expect(traceabilityMatrix).toContain("- TEST-020");
    expect(traceabilityMatrix).toContain("- TEST-022");
    expect(traceabilityMatrix).toContain("- TEST-025");
    expect(traceabilityMatrix).toContain("- TEST-026");
    expect(traceabilityMatrix).toContain("- TEST-027");
    expect(traceabilityMatrix).toContain("- TEST-028");
    expect(traceabilityMatrix).toContain("- TEST-029");
    expect(traceabilityMatrix).toContain("- TEST-030");
    expect(traceabilityMatrix).toContain("- TEST-034");
    expect(traceabilityMatrix).toContain("- TEST-037");
    expect(traceabilityMatrix).toContain("- TEST-038");
    expect(traceabilityMatrix).toContain("- TEST-039");

    const testsIndex = await readFile(path.join(modelRoot, "indexes", "tests.yaml"), "utf8");
    expect(testsIndex).toContain("id: TEST-012");
    expect(testsIndex).toContain("id: TEST-014");
    expect(testsIndex).toContain("id: TEST-018");
    expect(testsIndex).toContain("id: TEST-020");
    expect(testsIndex).toContain("id: TEST-022");
    expect(testsIndex).toContain("id: TEST-025");
    expect(testsIndex).toContain("id: TEST-026");
    expect(testsIndex).toContain("id: TEST-027");
    expect(testsIndex).toContain("id: TEST-028");
    expect(testsIndex).toContain("id: TEST-029");
    expect(testsIndex).toContain("id: TEST-030");
    expect(testsIndex).toContain("id: TEST-035");
    expect(testsIndex).toContain("id: TEST-037");
    expect(testsIndex).toContain("id: TEST-038");
    expect(testsIndex).toContain("id: TEST-039");
    expect(testsIndex).toContain("test_count: 39");

    const readinessIndex = await readFile(path.join(modelRoot, "indexes", "readiness.yaml"), "utf8");
    expect(readinessIndex).toContain("implementation_ready_features: []");
    expect(readinessIndex).toContain("feature_id: FEAT-011");

    const featureFile = await readFile(
      path.join(modelRoot, "features", "FEAT-014-change-existing-feature-descriptions.yaml"),
      "utf8",
    );
    expect(featureFile).toContain("revision: 2");
    expect(featureFile).toContain("last_event_id: EVT-20260601-0013");

    const requirementFile = await readFile(path.join(modelRoot, "requirements", "REQ-016.yaml"), "utf8");
    expect(requirementFile).toContain("revision: 2");
    expect(requirementFile).toContain("last_event_id: EVT-20260601-0014");

    const testFile = await readFile(path.join(modelRoot, "tests", "TEST-029.yaml"), "utf8");
    expect(testFile).toContain("acceptance_criterion_id: AC-026");
    expect(testFile).toContain("revision: 1");
    expect(testFile).toContain("last_event_id: EVT-20260601-0015");
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


