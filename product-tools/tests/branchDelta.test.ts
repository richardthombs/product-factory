import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { branchDelta } from "../src/delta/branchDelta.js";

const execFileAsync = promisify(execFile);
const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("branchDelta", () => {
// AC: AC-018
  it("reports product events unique to the current branch relative to a base branch", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "branch-delta-"));
    tempDirs.push(repoRoot);

    await execGit(["init", "-b", "main"], repoRoot);
    await execGit(["config", "user.name", "Test User"], repoRoot);
    await execGit(["config", "user.email", "test@example.com"], repoRoot);

    await writeEvent(
      repoRoot,
      "product-events/2026/06/01/EVT-20260601-0001-product-created.yaml",
      [
        "id: EVT-20260601-0001",
        "type: ProductCreated",
        "occurred_at: 2026-06-01T09:00:00.000Z",
        "actor:",
        "  type: agent",
        "  id: product_model_steward",
        "payload:",
        "  product_id: PROD-001",
        "  name: Product Factory",
        "  description: Event-sourced product knowledge system for agent-driven software delivery.",
      ],
    );

    await execGit(["add", "."], repoRoot);
    await execGit(["commit", "-m", "Base product events"], repoRoot);
    await execGit(["checkout", "-b", "feature/add-capability"], repoRoot);

    await writeEvent(
      repoRoot,
      "product-events/2026/06/01/EVT-20260601-0002-capability-added.yaml",
      [
        "id: EVT-20260601-0002",
        "type: CapabilityAdded",
        "occurred_at: 2026-06-01T09:01:00.000Z",
        "actor:",
        "  type: agent",
        "  id: capability_modeller",
        "payload:",
        "  capability_id: CAP-001",
        "  name: Branch delta reporting",
        "  description: Reports product events unique to the working branch.",
      ],
    );

    const report = await branchDelta({
      baseBranch: "main",
      cwd: repoRoot,
    });

    expect(report).toEqual({
      base_branch: "main",
      current_branch: "feature/add-capability",
      product_id: "PROD-001",
      events_root: "product-events",
      base_event_count: 1,
      current_event_count: 2,
      branch_only_event_count: 1,
      summary: {
        capabilities_added: 1,
        capabilities_changed: 0,
        capabilities_status_changed: 0,
        features_added: 0,
        features_changed: 0,
        features_moved: 0,
        features_deprecated: 0,
        features_status_changed: 0,
        requirements_added: 0,
        requirements_changed: 0,
        acceptance_criteria_added: 0,
        acceptance_criteria_changed: 0,
        tests_added: 0,
      },
      change_categories: ["extend"],
      branch_only_events: [
        {
          event_id: "EVT-20260601-0002",
          event_type: "CapabilityAdded",
          file_path: "product-events/2026/06/01/EVT-20260601-0002-capability-added.yaml",
          occurred_at: "2026-06-01T09:01:00.000Z",
          entity_refs: {
            capability_ids: ["CAP-001"],
            feature_ids: [],
            requirement_ids: [],
            acceptance_criterion_ids: [],
            test_ids: [],
          },
        },
      ],
      changed_entities: {
        capabilities: {
          added: [{ capability_id: "CAP-001" }],
          changed: [],
          status_changed: [],
        },
        features: {
          added: [],
          changed: [],
          moved: [],
          deprecated: [],
          status_changed: [],
        },
        requirements: {
          added: [],
          changed: [],
        },
        acceptance_criteria: {
          added: [],
          changed: [],
        },
        tests: {
          added: [],
        },
      },
    });
  });

// AC: AC-020
  it("reports the changed entities grouped by entity type and change kind", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "branch-delta-changed-entities-"));
    tempDirs.push(repoRoot);

    await execGit(["init", "-b", "main"], repoRoot);
    await execGit(["config", "user.name", "Test User"], repoRoot);
    await execGit(["config", "user.email", "test@example.com"], repoRoot);

    await writeEvent(repoRoot, "product-events/2026/06/01/EVT-20260601-0001-product-created.yaml", [
      "id: EVT-20260601-0001",
      "type: ProductCreated",
      "occurred_at: 2026-06-01T09:00:00.000Z",
      "actor:",
      "  type: agent",
      "  id: product_model_steward",
      "payload:",
      "  product_id: PROD-001",
      "  name: Product Factory",
      "  description: Event-sourced product knowledge system for agent-driven software delivery.",
    ]);
    await writeEvent(repoRoot, "product-events/2026/06/01/EVT-20260601-0002-capability-added.yaml", [
      "id: EVT-20260601-0002",
      "type: CapabilityAdded",
      "occurred_at: 2026-06-01T09:01:00.000Z",
      "actor:",
      "  type: agent",
      "  id: capability_modeller",
      "payload:",
      "  capability_id: CAP-001",
      "  name: Capability A",
      "  description: First capability.",
    ]);
    await writeEvent(repoRoot, "product-events/2026/06/01/EVT-20260601-0003-feature-added.yaml", [
      "id: EVT-20260601-0003",
      "type: FeatureAdded",
      "occurred_at: 2026-06-01T09:02:00.000Z",
      "actor:",
      "  type: agent",
      "  id: feature_specifier",
      "payload:",
      "  feature_id: FEAT-001",
      "  capability_id: CAP-001",
      "  name: Feature A",
      "  description: First feature.",
    ]);
    await writeEvent(repoRoot, "product-events/2026/06/01/EVT-20260601-0004-requirement-added.yaml", [
      "id: EVT-20260601-0004",
      "type: RequirementAdded",
      "occurred_at: 2026-06-01T09:03:00.000Z",
      "actor:",
      "  type: agent",
      "  id: requirement_analyst",
      "payload:",
      "  requirement_id: REQ-001",
      "  feature_id: FEAT-001",
      "  description: The system shall preserve headings.",
    ]);
    await writeEvent(repoRoot, "product-events/2026/06/01/EVT-20260601-0005-acceptance-criterion-added.yaml", [
      "id: EVT-20260601-0005",
      "type: AcceptanceCriterionAdded",
      "occurred_at: 2026-06-01T09:04:00.000Z",
      "actor:",
      "  type: agent",
      "  id: requirement_analyst",
      "payload:",
      "  acceptance_criterion_id: AC-001",
      "  requirement_id: REQ-001",
      "  text: Given headings, when exported, then they are preserved.",
    ]);

    await execGit(["add", "."], repoRoot);
    await execGit(["commit", "-m", "Base branch state"], repoRoot);
    await execGit(["checkout", "-b", "feature/entity-changes"], repoRoot);

    await writeEvent(repoRoot, "product-events/2026/06/01/EVT-20260601-0006-capability-added.yaml", [
      "id: EVT-20260601-0006",
      "type: CapabilityAdded",
      "occurred_at: 2026-06-01T09:05:00.000Z",
      "actor:",
      "  type: agent",
      "  id: capability_modeller",
      "payload:",
      "  capability_id: CAP-002",
      "  name: Capability B",
      "  description: Second capability.",
    ]);
    await writeEvent(repoRoot, "product-events/2026/06/01/EVT-20260601-0007-feature-moved-to-capability.yaml", [
      "id: EVT-20260601-0007",
      "type: FeatureMovedToCapability",
      "occurred_at: 2026-06-01T09:06:00.000Z",
      "actor:",
      "  type: agent",
      "  id: product_model_steward",
      "payload:",
      "  feature_id: FEAT-001",
      "  capability_id: CAP-002",
    ]);
    await writeEvent(repoRoot, "product-events/2026/06/01/EVT-20260601-0008-requirement-changed.yaml", [
      "id: EVT-20260601-0008",
      "type: RequirementChanged",
      "occurred_at: 2026-06-01T09:07:00.000Z",
      "actor:",
      "  type: agent",
      "  id: requirement_analyst",
      "payload:",
      "  requirement_id: REQ-001",
      "  description: The system shall preserve heading structure consistently.",
    ]);
    await writeEvent(repoRoot, "product-events/2026/06/01/EVT-20260601-0009-acceptance-criterion-changed.yaml", [
      "id: EVT-20260601-0009",
      "type: AcceptanceCriterionChanged",
      "occurred_at: 2026-06-01T09:08:00.000Z",
      "actor:",
      "  type: agent",
      "  id: requirement_analyst",
      "payload:",
      "  acceptance_criterion_id: AC-001",
      "  text: Given headings, when exported, then heading structure is preserved consistently.",
    ]);

    const report = await branchDelta({
      baseBranch: "main",
      cwd: repoRoot,
    });

    expect(report.summary).toEqual({
      capabilities_added: 1,
      capabilities_changed: 0,
      capabilities_status_changed: 0,
      features_added: 0,
      features_changed: 0,
      features_moved: 1,
      features_deprecated: 0,
      features_status_changed: 0,
      requirements_added: 0,
      requirements_changed: 1,
      acceptance_criteria_added: 0,
      acceptance_criteria_changed: 1,
      tests_added: 0,
    });
    expect(report.changed_entities).toEqual({
      capabilities: {
        added: [{ capability_id: "CAP-002" }],
        changed: [],
        status_changed: [],
      },
      features: {
        added: [],
        changed: [],
        moved: [{
          feature_id: "FEAT-001",
          from_capability_id: "CAP-001",
          to_capability_id: "CAP-002",
        }],
        deprecated: [],
        status_changed: [],
      },
      requirements: {
        added: [],
        changed: [{ requirement_id: "REQ-001" }],
      },
      acceptance_criteria: {
        added: [],
        changed: [{ acceptance_criterion_id: "AC-001" }],
      },
      tests: {
        added: [],
      },
    });
  });

// AC: AC-021
  it("reports inferred change categories present in the branch delta", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "branch-delta-categories-"));
    tempDirs.push(repoRoot);

    await execGit(["init", "-b", "main"], repoRoot);
    await execGit(["config", "user.name", "Test User"], repoRoot);
    await execGit(["config", "user.email", "test@example.com"], repoRoot);

    await writeEvent(repoRoot, "product-events/2026/06/01/EVT-20260601-0001-product-created.yaml", [
      "id: EVT-20260601-0001",
      "type: ProductCreated",
      "occurred_at: 2026-06-01T09:00:00.000Z",
      "actor:",
      "  type: agent",
      "  id: product_model_steward",
      "payload:",
      "  product_id: PROD-001",
      "  name: Product Factory",
      "  description: Event-sourced product knowledge system for agent-driven software delivery.",
    ]);
    await writeEvent(repoRoot, "product-events/2026/06/01/EVT-20260601-0002-capability-added.yaml", [
      "id: EVT-20260601-0002",
      "type: CapabilityAdded",
      "occurred_at: 2026-06-01T09:01:00.000Z",
      "actor:",
      "  type: agent",
      "  id: capability_modeller",
      "payload:",
      "  capability_id: CAP-001",
      "  name: Capability A",
      "  description: First capability.",
    ]);
    await writeEvent(repoRoot, "product-events/2026/06/01/EVT-20260601-0003-capability-added.yaml", [
      "id: EVT-20260601-0003",
      "type: CapabilityAdded",
      "occurred_at: 2026-06-01T09:02:00.000Z",
      "actor:",
      "  type: agent",
      "  id: capability_modeller",
      "payload:",
      "  capability_id: CAP-002",
      "  name: Capability B",
      "  description: Second capability.",
    ]);
    await writeEvent(repoRoot, "product-events/2026/06/01/EVT-20260601-0004-feature-added.yaml", [
      "id: EVT-20260601-0004",
      "type: FeatureAdded",
      "occurred_at: 2026-06-01T09:03:00.000Z",
      "actor:",
      "  type: agent",
      "  id: feature_specifier",
      "payload:",
      "  feature_id: FEAT-001",
      "  capability_id: CAP-001",
      "  name: Feature A",
      "  description: First feature.",
    ]);
    await writeEvent(repoRoot, "product-events/2026/06/01/EVT-20260601-0005-requirement-added.yaml", [
      "id: EVT-20260601-0005",
      "type: RequirementAdded",
      "occurred_at: 2026-06-01T09:04:00.000Z",
      "actor:",
      "  type: agent",
      "  id: requirement_analyst",
      "payload:",
      "  requirement_id: REQ-001",
      "  feature_id: FEAT-001",
      "  description: The system shall preserve headings.",
    ]);
    await writeEvent(repoRoot, "product-events/2026/06/01/EVT-20260601-0006-acceptance-criterion-added.yaml", [
      "id: EVT-20260601-0006",
      "type: AcceptanceCriterionAdded",
      "occurred_at: 2026-06-01T09:05:00.000Z",
      "actor:",
      "  type: agent",
      "  id: requirement_analyst",
      "payload:",
      "  acceptance_criterion_id: AC-001",
      "  requirement_id: REQ-001",
      "  text: Given headings, when exported, then they are preserved.",
    ]);

    await writeFile(path.join(repoRoot, "example.test.ts"), [
      "// AC: AC-001",
      "it(\"example branch delta test\", async () => {",
      "  expect(true).toBe(true);",
      "});",
      "",
    ].join("\n"), "utf8");

    await execGit(["add", "."], repoRoot);
    await execGit(["commit", "-m", "Base branch state"], repoRoot);
    await execGit(["checkout", "-b", "feature/categories"], repoRoot);

    await writeEvent(repoRoot, "product-events/2026/06/01/EVT-20260601-0007-capability-added.yaml", [
      "id: EVT-20260601-0007",
      "type: CapabilityAdded",
      "occurred_at: 2026-06-01T09:06:00.000Z",
      "actor:",
      "  type: agent",
      "  id: capability_modeller",
      "payload:",
      "  capability_id: CAP-003",
      "  name: Capability C",
      "  description: Third capability.",
    ]);
    await writeEvent(repoRoot, "product-events/2026/06/01/EVT-20260601-0008-requirement-changed.yaml", [
      "id: EVT-20260601-0008",
      "type: RequirementChanged",
      "occurred_at: 2026-06-01T09:07:00.000Z",
      "actor:",
      "  type: agent",
      "  id: requirement_analyst",
      "payload:",
      "  requirement_id: REQ-001",
      "  description: The system shall preserve heading structure consistently.",
    ]);
    await writeEvent(repoRoot, "product-events/2026/06/01/EVT-20260601-0009-feature-moved-to-capability.yaml", [
      "id: EVT-20260601-0009",
      "type: FeatureMovedToCapability",
      "occurred_at: 2026-06-01T09:08:00.000Z",
      "actor:",
      "  type: agent",
      "  id: product_model_steward",
      "payload:",
      "  feature_id: FEAT-001",
      "  capability_id: CAP-002",
    ]);
    await writeEvent(repoRoot, "product-events/2026/06/01/EVT-20260601-0010-feature-deprecated.yaml", [
      "id: EVT-20260601-0010",
      "type: FeatureDeprecated",
      "occurred_at: 2026-06-01T09:09:00.000Z",
      "actor:",
      "  type: agent",
      "  id: product_model_steward",
      "payload:",
      "  feature_id: FEAT-001",
      "  reason: Replaced by a new workflow.",
    ]);
    await writeEvent(repoRoot, "product-events/2026/06/01/EVT-20260601-0011-test-created.yaml", [
      "id: EVT-20260601-0011",
      "type: TestCreated",
      "occurred_at: 2026-06-01T09:10:00.000Z",
      "actor:",
      "  type: agent",
      "  id: test_agent",
      "payload:",
      "  test_id: TEST-001",
      "  acceptance_criterion_id: AC-001",
      `  file_path: ${path.join(repoRoot, "example.test.ts").replaceAll("\\", "/")}`,
      "  test_name: example branch delta test",
    ]);
    await writeEvent(repoRoot, "product-events/2026/06/01/EVT-20260601-0012-feature-status-changed.yaml", [
      "id: EVT-20260601-0012",
      "type: FeatureStatusChanged",
      "occurred_at: 2026-06-01T09:11:00.000Z",
      "actor:",
      "  type: agent",
      "  id: product_model_steward",
      "payload:",
      "  feature_id: FEAT-001",
      "  status: implementation_ready",
    ]);

    const report = await branchDelta({
      baseBranch: "main",
      cwd: repoRoot,
    });

    expect(report.change_categories).toEqual([
      "extend",
      "refine",
      "reshape",
      "deprecate",
      "verify",
      "readiness",
    ]);
  });

// AC: AC-019
  it("fails when the base branch cannot be resolved", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "branch-delta-missing-base-"));
    tempDirs.push(repoRoot);

    await execGit(["init", "-b", "main"], repoRoot);
    await execGit(["config", "user.name", "Test User"], repoRoot);
    await execGit(["config", "user.email", "test@example.com"], repoRoot);

    await writeEvent(
      repoRoot,
      "product-events/2026/06/01/EVT-20260601-0001-product-created.yaml",
      [
        "id: EVT-20260601-0001",
        "type: ProductCreated",
        "occurred_at: 2026-06-01T09:00:00.000Z",
        "actor:",
        "  type: agent",
        "  id: product_model_steward",
        "payload:",
        "  product_id: PROD-001",
        "  name: Product Factory",
        "  description: Event-sourced product knowledge system for agent-driven software delivery.",
      ],
    );

    await expect(branchDelta({
      baseBranch: "does-not-exist",
      cwd: repoRoot,
    })).rejects.toThrow("git ls-tree -r --name-only does-not-exist");
  });
});

async function writeEvent(repoRoot: string, relativePath: string, lines: string[]): Promise<void> {
  const filePath = path.join(repoRoot, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${lines.join("\n")}\n`, "utf8");
}

async function execGit(args: string[], cwd: string): Promise<void> {
  await execFileAsync("git", args, { cwd });
}


