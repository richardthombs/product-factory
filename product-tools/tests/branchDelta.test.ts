import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { branchDelta } from "../src/delta/branchDelta.js";
import { writeBranchDeltaArtifacts } from "../src/delta/writeBranchDeltaArtifacts.js";

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
      impacted_entities: {
        capability_ids: ["CAP-001"],
        feature_ids: [],
        requirement_ids: [],
        acceptance_criterion_ids: [],
        test_ids: [],
      },
      contextual_changes: {
        capabilities: [
          {
            capability_id: "CAP-001",
            capability_name: "Branch delta reporting",
            description: "Reports product events unique to the working branch.",
            change_notes: ["added"],
            features: [],
          },
        ],
      },
    });
  });

// AC: AC-020, AC-022
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
    expect(report.impacted_entities).toEqual({
      capability_ids: ["CAP-001", "CAP-002"],
      feature_ids: ["FEAT-001"],
      requirement_ids: ["REQ-001"],
      acceptance_criterion_ids: ["AC-001"],
      test_ids: [],
    });
  });

  it("treats requirements and acceptance criteria added then refined on the branch as added in the delta report", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "branch-delta-added-then-refined-"));
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

    await execGit(["add", "."], repoRoot);
    await execGit(["commit", "-m", "Base branch state"], repoRoot);
    await execGit(["checkout", "-b", "feature/add-and-refine"], repoRoot);

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
      "  description: The system shall report branch-local artifacts.",
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
      "  text: Given a branch delta, when artifacts are written, then they are stored locally.",
    ]);
    await writeEvent(repoRoot, "product-events/2026/06/01/EVT-20260601-0006-requirement-changed.yaml", [
      "id: EVT-20260601-0006",
      "type: RequirementChanged",
      "occurred_at: 2026-06-01T09:05:00.000Z",
      "actor:",
      "  type: agent",
      "  id: requirement_analyst",
      "payload:",
      "  requirement_id: REQ-001",
      "  description: The system shall report gitignored branch-local artifacts.",
    ]);
    await writeEvent(repoRoot, "product-events/2026/06/01/EVT-20260601-0007-acceptance-criterion-changed.yaml", [
      "id: EVT-20260601-0007",
      "type: AcceptanceCriterionChanged",
      "occurred_at: 2026-06-01T09:06:00.000Z",
      "actor:",
      "  type: agent",
      "  id: requirement_analyst",
      "payload:",
      "  acceptance_criterion_id: AC-001",
      "  text: Given a branch delta, when artifacts are written, then they are stored in a gitignored branch-local folder.",
    ]);

    const report = await branchDelta({
      baseBranch: "main",
      cwd: repoRoot,
    });

    expect(report.summary).toEqual({
      capabilities_added: 0,
      capabilities_changed: 0,
      capabilities_status_changed: 0,
      features_added: 0,
      features_changed: 0,
      features_moved: 0,
      features_deprecated: 0,
      features_status_changed: 0,
      requirements_added: 1,
      requirements_changed: 0,
      acceptance_criteria_added: 1,
      acceptance_criteria_changed: 0,
      tests_added: 0,
    });
    expect(report.change_categories).toEqual(["extend"]);
    expect(report.changed_entities.requirements).toEqual({
      added: [{ requirement_id: "REQ-001" }],
      changed: [],
    });
    expect(report.changed_entities.acceptance_criteria).toEqual({
      added: [{ acceptance_criterion_id: "AC-001" }],
      changed: [],
    });
    expect(report.contextual_changes.capabilities[0].features[0].requirements[0].change_notes).toEqual(["added"]);
    expect(report.contextual_changes.capabilities[0].features[0].requirements[0].description).toBe(
      "The system shall report gitignored branch-local artifacts.",
    );
    expect(report.contextual_changes.capabilities[0].features[0].requirements[0].acceptance_criteria[0].change_notes).toEqual(["added"]);
    expect(report.contextual_changes.capabilities[0].features[0].requirements[0].acceptance_criteria[0].text).toBe(
      "Given a branch delta, when artifacts are written, then they are stored in a gitignored branch-local folder.",
    );
  });

  it("treats capabilities and features added then evolved on the branch as added in the delta report", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "branch-delta-added-feature-evolved-"));
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

    await execGit(["add", "."], repoRoot);
    await execGit(["commit", "-m", "Base branch state"], repoRoot);
    await execGit(["checkout", "-b", "feature/add-and-evolve-feature"], repoRoot);

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
    await writeEvent(repoRoot, "product-events/2026/06/01/EVT-20260601-0003-capability-status-changed.yaml", [
      "id: EVT-20260601-0003",
      "type: CapabilityStatusChanged",
      "occurred_at: 2026-06-01T09:02:00.000Z",
      "actor:",
      "  type: agent",
      "  id: product_model_steward",
      "payload:",
      "  capability_id: CAP-001",
      "  status: scoped",
      "  reason: Scoped on branch.",
    ]);
    await writeEvent(repoRoot, "product-events/2026/06/01/EVT-20260601-0004-capability-added.yaml", [
      "id: EVT-20260601-0004",
      "type: CapabilityAdded",
      "occurred_at: 2026-06-01T09:03:00.000Z",
      "actor:",
      "  type: agent",
      "  id: capability_modeller",
      "payload:",
      "  capability_id: CAP-002",
      "  name: Capability B",
      "  description: Second capability.",
    ]);
    await writeEvent(repoRoot, "product-events/2026/06/01/EVT-20260601-0005-feature-added.yaml", [
      "id: EVT-20260601-0005",
      "type: FeatureAdded",
      "occurred_at: 2026-06-01T09:04:00.000Z",
      "actor:",
      "  type: agent",
      "  id: feature_specifier",
      "payload:",
      "  feature_id: FEAT-001",
      "  capability_id: CAP-001",
      "  name: Feature A",
      "  description: Initial feature description.",
    ]);
    await writeEvent(repoRoot, "product-events/2026/06/01/EVT-20260601-0006-feature-changed.yaml", [
      "id: EVT-20260601-0006",
      "type: FeatureChanged",
      "occurred_at: 2026-06-01T09:05:00.000Z",
      "actor:",
      "  type: agent",
      "  id: feature_specifier",
      "payload:",
      "  feature_id: FEAT-001",
      "  description: Final feature description.",
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
    await writeEvent(repoRoot, "product-events/2026/06/01/EVT-20260601-0008-feature-status-changed.yaml", [
      "id: EVT-20260601-0008",
      "type: FeatureStatusChanged",
      "occurred_at: 2026-06-01T09:07:00.000Z",
      "actor:",
      "  type: agent",
      "  id: product_model_steward",
      "payload:",
      "  feature_id: FEAT-001",
      "  status: implementation_ready",
      "  reason: Ready on branch.",
    ]);

    const report = await branchDelta({
      baseBranch: "main",
      cwd: repoRoot,
    });

    expect(report.summary).toEqual({
      capabilities_added: 2,
      capabilities_changed: 0,
      capabilities_status_changed: 0,
      features_added: 1,
      features_changed: 0,
      features_moved: 0,
      features_deprecated: 0,
      features_status_changed: 0,
      requirements_added: 0,
      requirements_changed: 0,
      acceptance_criteria_added: 0,
      acceptance_criteria_changed: 0,
      tests_added: 0,
    });
    expect(report.change_categories).toEqual(["extend"]);
    expect(report.changed_entities.capabilities).toEqual({
      added: [{ capability_id: "CAP-001" }, { capability_id: "CAP-002" }],
      changed: [],
      status_changed: [],
    });
    expect(report.changed_entities.features).toEqual({
      added: [{ feature_id: "FEAT-001" }],
      changed: [],
      moved: [],
      deprecated: [],
      status_changed: [],
    });
    expect(report.contextual_changes.capabilities).toEqual([
      {
        capability_id: "CAP-001",
        capability_name: "Capability A",
        description: "First capability.",
        change_notes: ["added"],
        features: [],
      },
      {
        capability_id: "CAP-002",
        capability_name: "Capability B",
        description: "Second capability.",
        change_notes: ["added"],
        features: [
          {
            feature_id: "FEAT-001",
            feature_name: "Feature A",
            description: "Final feature description.",
            change_notes: ["added"],
            requirements: [],
          },
        ],
      },
    ]);
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

// AC: AC-022, AC-023
  it("writes standard branch-delta artifacts to product-model", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "branch-delta-artifacts-"));
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

    await execGit(["add", "."], repoRoot);
    await execGit(["commit", "-m", "Base product events"], repoRoot);
    await execGit(["checkout", "-b", "feature/add-capability"], repoRoot);

    await writeEvent(repoRoot, "product-events/2026/06/01/EVT-20260601-0002-capability-added.yaml", [
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
    ]);

    const result = await writeBranchDeltaArtifacts({
      baseBranch: "main",
      cwd: repoRoot,
    });

    expect(path.basename(result.yamlPath)).toBe("branch-delta.yaml");
    expect(path.basename(result.markdownPath)).toBe("branch-delta.md");
    expect(path.dirname(result.yamlPath)).toBe(path.join(repoRoot, "branch-delta"));
    expect(path.dirname(result.markdownPath)).toBe(path.join(repoRoot, "branch-delta"));

    const yaml = await readFile(result.yamlPath, "utf8");
    expect(yaml).toContain("# Generated from /product-events.");
    expect(yaml).toContain("branch_only_event_count: 1");

    const markdown = await readFile(result.markdownPath, "utf8");
    expect(markdown).toContain("<!-- Generated from /product-events. -->");
    expect(markdown).toContain("# feature/add-capability — Branch Delta");
    expect(markdown).toContain("# Proposed Changes");
    expect(markdown).toContain("## CAP-001 — Branch delta reporting (added)");
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





