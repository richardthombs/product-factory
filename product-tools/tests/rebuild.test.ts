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
      eventCount: 101,
      capabilityCount: 2,
      featureCount: 14,
      requirementCount: 16,
      acceptanceCriterionCount: 26,
      testCount: 29,
      lastEventId: "EVT-20260601-0015",
      lastOccurredAt: "2026-06-01T07:12:03.000Z",
    });

    const productYaml = await readFile(path.join(modelRoot, "product.yaml"), "utf8");
    expect(productYaml).toContain("id: PROD-001");
    expect(productYaml).toContain("tests: 29");

    const projectMarkdown = await readFile(path.join(modelRoot, "project.md"), "utf8");
    expect(projectMarkdown).toContain("# Product Factory");
    expect(projectMarkdown).toContain("### FEAT-006 — Rebuild product model");
    expect(projectMarkdown).toContain("### FEAT-009 — Change existing requirements and acceptance criteria");
    expect(projectMarkdown).toContain("### FEAT-011 — Track capability and feature readiness");
    expect(projectMarkdown).toContain("### FEAT-012 — Report branch delta");
    expect(projectMarkdown).toContain("### FEAT-014 — Change existing feature descriptions");
    expect(projectMarkdown).toContain("Reports the net product delta between a working branch and a base branch.");
    expect(projectMarkdown).toContain("### FEAT-013 — Derive work packages from branch delta");
    expect(projectMarkdown).toContain("Derives deterministic implementation work packages from the net branch-delta report.");
    expect(projectMarkdown).toContain("**AC-021**: Given entities that are added and then further refined only on the working branch, when the branch-delta helper is run, then it reports them as added and infers change categories from the net branch delta rather than intermediate branch-only churn. `TEST-022`.");
    expect(projectMarkdown).toContain("**AC-023**: Given a working branch and base branch, when the branch-delta helper is run without a custom output path, then it writes branch-delta/branch-delta.yaml and branch-delta/branch-delta.md as gitignored branch-local artifacts, and the markdown presents changed entities in parent context with explicit change labels. `TEST-025`, `TEST-026`.");
    expect(projectMarkdown).toContain("**AC-024**: Given a net branch delta with changed entities under one feature, when the derive-work-packages helper is run, then it emits a work-package proposal that groups that net changed scope under that feature. `TEST-027`.");
    expect(projectMarkdown).toContain("**AC-025**: Given a net branch delta with changed entities, when the derive-work-packages helper is run, then each derived work package includes its scoped capability, feature, requirement, acceptance-criterion, and test ids together with rationale and dependency information for that net changed scope. `TEST-028`.");
    expect(projectMarkdown).toContain("**AC-026**: Given an existing feature, when the change-feature helper is run with a new description, then the system records a FeatureChanged event and projects the updated feature description. `TEST-029`.");

    const traceabilityMatrix = await readFile(path.join(modelRoot, "indexes", "traceability-matrix.yaml"), "utf8");
    expect(traceabilityMatrix).toContain("acceptance_criterion_id: AC-007");
    expect(traceabilityMatrix).toContain("acceptance_criterion_id: AC-013");
    expect(traceabilityMatrix).toContain("acceptance_criterion_id: AC-017");
    expect(traceabilityMatrix).toContain("acceptance_criterion_id: AC-019");
    expect(traceabilityMatrix).toContain("acceptance_criterion_id: AC-021");
    expect(traceabilityMatrix).toContain("acceptance_criterion_id: AC-023");
    expect(traceabilityMatrix).toContain("acceptance_criterion_id: AC-024");
    expect(traceabilityMatrix).toContain("acceptance_criterion_id: AC-025");
    expect(traceabilityMatrix).toContain("acceptance_criterion_id: AC-026");
    expect(traceabilityMatrix).toContain("- TEST-012");
    expect(traceabilityMatrix).toContain("- TEST-014");
    expect(traceabilityMatrix).toContain("- TEST-018");
    expect(traceabilityMatrix).toContain("- TEST-020");
    expect(traceabilityMatrix).toContain("- TEST-022");
    expect(traceabilityMatrix).toContain("- TEST-025");
    expect(traceabilityMatrix).toContain("- TEST-026");
    expect(traceabilityMatrix).toContain("- TEST-027");
    expect(traceabilityMatrix).toContain("- TEST-028");
    expect(traceabilityMatrix).toContain("- TEST-029");
  });
});

