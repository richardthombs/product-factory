import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import YAML from "yaml";
import { afterEach, describe, expect, it } from "vitest";
import { reconcileEvents } from "../src/reconciliation/reconcileEvents.js";
import { writeReconciliationArtifacts } from "../src/reconciliation/writeReconciliationArtifacts.js";
import type { ProductEvent } from "../src/schemas/events.js";

const execFileAsync = promisify(execFile);
const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("reconcileEvents", () => {
// AC: AC-027
  it("reconciles a clean branch against the latest main entity revisions", async () => {
    const repoRoot = await initRepo("reconcile-clean-");

    await writeEvent(repoRoot, "product-events/2026/06/01/EVT-20260601-0001-product-created.yaml", {
      id: "EVT-20260601-0001",
      type: "ProductCreated",
      occurred_at: "2026-06-01T09:00:00.000Z",
      actor: { type: "agent", id: "product_model_steward" },
      payload: {
        product_id: "PROD-001",
        name: "Product Factory",
        description: "Event-sourced product knowledge system for agent-driven software delivery.",
      },
    });
    await writeEvent(repoRoot, "product-events/2026/06/01/EVT-20260601-0002-capability-added.yaml", {
      id: "EVT-20260601-0002",
      type: "CapabilityAdded",
      occurred_at: "2026-06-01T09:01:00.000Z",
      actor: { type: "agent", id: "capability_modeller" },
      payload: {
        capability_id: "CAP-001",
        name: "Validation",
        description: "Validates product events.",
      },
    });
    await writeEvent(repoRoot, "product-events/2026/06/01/EVT-20260601-0003-feature-added.yaml", {
      id: "EVT-20260601-0003",
      type: "FeatureAdded",
      occurred_at: "2026-06-01T09:02:00.000Z",
      actor: { type: "agent", id: "feature_specifier" },
      payload: {
        feature_id: "FEAT-001",
        capability_id: "CAP-001",
        name: "Branch reconciliation",
        description: "Reconciles branch-only events.",
      },
    });

    await execGit(["add", "."], repoRoot);
    await execGit(["commit", "-m", "Base accepted state"], repoRoot);
    await execGit(["checkout", "-b", "feature/clean"], repoRoot);

    await writeEvent(repoRoot, "product-events/2026/06/01/EVT-20260601-0004-requirement-added.yaml", {
      id: "EVT-20260601-0004",
      type: "RequirementAdded",
      occurred_at: "2026-06-01T09:03:00.000Z",
      actor: { type: "agent", id: "requirement_analyst" },
      metadata: {
        concurrency: {
          preconditions: [
            {
              entity_type: "feature",
              entity_id: "FEAT-001",
              expected_revision: 1,
              expected_last_entity_event_id: "EVT-20260601-0003",
            },
          ],
        },
      },
      payload: {
        requirement_id: "REQ-001",
        feature_id: "FEAT-001",
        description: "The system shall reconcile branch-only events against latest main.",
      },
    });

    await execGit(["add", "."], repoRoot);
    await execGit(["commit", "-m", "Branch requirement"], repoRoot);

    const report = await reconcileEvents({
      baseBranch: "main",
      cwd: repoRoot,
    });

    expect(report.status).toBe("clean");
    expect(report.checked_event_count).toBe(1);
    expect(report.clean_event_count).toBe(1);
    expect(report.conflicting_event_count).toBe(0);
    expect(report.clean_event_ids).toEqual(["EVT-20260601-0004"]);
    expect(report.conflicts).toEqual([]);
    expect(report.base_commit).toMatch(/^[a-f0-9]{40}$/);
  });

// AC: AC-028
  it("detects a stale branch event when the accepted entity revision has advanced on main", async () => {
    const repoRoot = await initRepo("reconcile-stale-");

    await writeBaseRequirementState(repoRoot);
    await execGit(["add", "."], repoRoot);
    await execGit(["commit", "-m", "Base accepted state"], repoRoot);
    await execGit(["checkout", "-b", "feature/stale"], repoRoot);

    await writeEvent(repoRoot, "product-events/2026/06/01/EVT-20260601-0006-requirement-changed.yaml", {
      id: "EVT-20260601-0006",
      type: "RequirementChanged",
      occurred_at: "2026-06-01T09:05:00.000Z",
      actor: { type: "agent", id: "requirement_analyst" },
      metadata: {
        concurrency: {
          preconditions: [
            {
              entity_type: "requirement",
              entity_id: "REQ-001",
              expected_revision: 2,
              expected_last_entity_event_id: "EVT-20260601-0005",
            },
          ],
        },
      },
      payload: {
        requirement_id: "REQ-001",
        description: "The system shall reconcile stale branches conservatively.",
      },
    });
    await execGit(["add", "."], repoRoot);
    await execGit(["commit", "-m", "Branch requirement refinement"], repoRoot);

    await execGit(["checkout", "main"], repoRoot);
    await writeEvent(repoRoot, "product-events/2026/06/01/EVT-20260601-0007-requirement-changed.yaml", {
      id: "EVT-20260601-0007",
      type: "RequirementChanged",
      occurred_at: "2026-06-01T09:06:00.000Z",
      actor: { type: "agent", id: "requirement_analyst" },
      payload: {
        requirement_id: "REQ-001",
        description: "The system shall reconcile accepted revisions before merge.",
      },
    });
    await execGit(["add", "."], repoRoot);
    await execGit(["commit", "-m", "Accepted main refinement"], repoRoot);

    await execGit(["checkout", "feature/stale"], repoRoot);

    const report = await reconcileEvents({
      baseBranch: "main",
      cwd: repoRoot,
    });

    expect(report.status).toBe("conflicts");
    expect(report.checked_event_count).toBe(1);
    expect(report.clean_event_count).toBe(0);
    expect(report.conflicting_event_count).toBe(1);
    expect(report.conflicts).toEqual([
      {
        event_id: "EVT-20260601-0006",
        event_type: "RequirementChanged",
        file_path: "product-events/2026/06/01/EVT-20260601-0006-requirement-changed.yaml",
        entity_type: "requirement",
        entity_id: "REQ-001",
        expected_revision: 2,
        actual_revision: 3,
        expected_last_entity_event_id: "EVT-20260601-0005",
        actual_last_entity_event_id: "EVT-20260601-0007",
        resolution: "manual_reconcile_required",
      },
    ]);
  });

// AC: AC-029
  it("treats expected_last_entity_event_id as entity-specific rather than stream-global", async () => {
    const repoRoot = await initRepo("reconcile-entity-specific-");

    await writeBaseRequirementState(repoRoot);
    await writeEvent(repoRoot, "product-events/2026/06/01/EVT-20260601-0006-capability-added.yaml", {
      id: "EVT-20260601-0006",
      type: "CapabilityAdded",
      occurred_at: "2026-06-01T09:05:00.000Z",
      actor: { type: "agent", id: "capability_modeller" },
      payload: {
        capability_id: "CAP-002",
        name: "Unrelated capability",
        description: "Does not affect REQ-001.",
      },
    });

    await execGit(["add", "."], repoRoot);
    await execGit(["commit", "-m", "Base accepted state with unrelated later event"], repoRoot);
    await execGit(["checkout", "-b", "feature/entity-specific"], repoRoot);

    await writeEvent(repoRoot, "product-events/2026/06/01/EVT-20260601-0007-requirement-changed.yaml", {
      id: "EVT-20260601-0007",
      type: "RequirementChanged",
      occurred_at: "2026-06-01T09:06:00.000Z",
      actor: { type: "agent", id: "requirement_analyst" },
      metadata: {
        concurrency: {
          preconditions: [
            {
              entity_type: "requirement",
              entity_id: "REQ-001",
              expected_revision: 2,
              expected_last_entity_event_id: "EVT-20260601-0005",
            },
          ],
        },
      },
      payload: {
        requirement_id: "REQ-001",
        description: "The system shall compare expected_last_entity_event_id per entity.",
      },
    });
    await execGit(["add", "."], repoRoot);
    await execGit(["commit", "-m", "Branch entity-specific refinement"], repoRoot);

    const report = await reconcileEvents({
      baseBranch: "main",
      cwd: repoRoot,
    });

    expect(report.status).toBe("clean");
    expect(report.conflicts).toEqual([]);
    expect(report.clean_event_ids).toEqual(["EVT-20260601-0007"]);
  });

// AC: AC-030
  it("writes reconciliation artifacts to branch-delta by default", async () => {
    const repoRoot = await initRepo("reconcile-artifacts-");

    await writeBaseRequirementState(repoRoot);
    await execGit(["add", "."], repoRoot);
    await execGit(["commit", "-m", "Base accepted state"], repoRoot);
    await execGit(["checkout", "-b", "feature/artifacts"], repoRoot);

    await writeEvent(repoRoot, "product-events/2026/06/01/EVT-20260601-0006-requirement-changed.yaml", {
      id: "EVT-20260601-0006",
      type: "RequirementChanged",
      occurred_at: "2026-06-01T09:05:00.000Z",
      actor: { type: "agent", id: "requirement_analyst" },
      metadata: {
        concurrency: {
          preconditions: [
            {
              entity_type: "requirement",
              entity_id: "REQ-001",
              expected_revision: 2,
              expected_last_entity_event_id: "EVT-20260601-0005",
            },
          ],
        },
      },
      payload: {
        requirement_id: "REQ-001",
        description: "The system shall write reconciliation artifacts locally.",
      },
    });
    await execGit(["add", "."], repoRoot);
    await execGit(["commit", "-m", "Branch reconciliation change"], repoRoot);

    const result = await writeReconciliationArtifacts({
      baseBranch: "main",
      cwd: repoRoot,
    });

    expect(path.basename(result.yamlPath)).toBe("reconciliation.yaml");
    expect(path.basename(result.markdownPath)).toBe("reconciliation.md");
    expect(path.dirname(result.yamlPath)).toBe(path.join(repoRoot, "branch-delta"));
    expect(path.dirname(result.markdownPath)).toBe(path.join(repoRoot, "branch-delta"));
  });

// AC: AC-027
  it("exits cleanly without stdout, stderr, or artifacts when reconciliation is clean", async () => {
    const repoRoot = await initRepo("reconcile-cli-clean-");

    await writeBaseRequirementState(repoRoot);
    await execGit(["add", "."], repoRoot);
    await execGit(["commit", "-m", "Base accepted state"], repoRoot);
    await execGit(["checkout", "-b", "feature/cli-clean"], repoRoot);

    await writeEvent(repoRoot, "product-events/2026/06/01/EVT-20260601-0006-requirement-changed.yaml", {
      id: "EVT-20260601-0006",
      type: "RequirementChanged",
      occurred_at: "2026-06-01T09:05:00.000Z",
      actor: { type: "agent", id: "requirement_analyst" },
      metadata: {
        concurrency: {
          preconditions: [
            {
              entity_type: "requirement",
              entity_id: "REQ-001",
              expected_revision: 2,
              expected_last_entity_event_id: "EVT-20260601-0005",
            },
          ],
        },
      },
      payload: {
        requirement_id: "REQ-001",
        description: "The system shall exit silently when reconciliation is clean.",
      },
    });
    await execGit(["add", "."], repoRoot);
    await execGit(["commit", "-m", "Branch clean change"], repoRoot);

    const tsxPath = path.resolve(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
    const cliPath = path.resolve(process.cwd(), "product-tools", "src", "cli", "reconcile-events.ts");
    const result = await execFileAsync(process.execPath, [tsxPath, cliPath, "--base", "main"], { cwd: repoRoot });

    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
    await expect(readFile(path.join(repoRoot, "branch-delta", "reconciliation.yaml"), "utf8")).rejects.toThrow();
    await expect(readFile(path.join(repoRoot, "branch-delta", "reconciliation.md"), "utf8")).rejects.toThrow();
  });

// AC: AC-030, AC-031
  it("returns a non-zero exit code when reconciliation conflicts are found", async () => {
    const repoRoot = await initRepo("reconcile-cli-failure-");

    await writeBaseRequirementState(repoRoot);
    await execGit(["add", "."], repoRoot);
    await execGit(["commit", "-m", "Base accepted state"], repoRoot);
    await execGit(["checkout", "-b", "feature/cli-failure"], repoRoot);

    await writeEvent(repoRoot, "product-events/2026/06/01/EVT-20260601-0006-requirement-changed.yaml", {
      id: "EVT-20260601-0006",
      type: "RequirementChanged",
      occurred_at: "2026-06-01T09:05:00.000Z",
      actor: { type: "agent", id: "requirement_analyst" },
      metadata: {
        concurrency: {
          preconditions: [
            {
              entity_type: "requirement",
              entity_id: "REQ-001",
              expected_revision: 2,
              expected_last_entity_event_id: "EVT-20260601-0005",
            },
          ],
        },
      },
      payload: {
        requirement_id: "REQ-001",
        description: "The system shall fail the reconciliation CLI when stale.",
      },
    });
    await execGit(["add", "."], repoRoot);
    await execGit(["commit", "-m", "Branch stale change"], repoRoot);

    await execGit(["checkout", "main"], repoRoot);
    await writeEvent(repoRoot, "product-events/2026/06/01/EVT-20260601-0007-requirement-changed.yaml", {
      id: "EVT-20260601-0007",
      type: "RequirementChanged",
      occurred_at: "2026-06-01T09:06:00.000Z",
      actor: { type: "agent", id: "requirement_analyst" },
      payload: {
        requirement_id: "REQ-001",
        description: "The system shall advance accepted state before the branch is checked.",
      },
    });
    await execGit(["add", "."], repoRoot);
    await execGit(["commit", "-m", "Accepted main refinement"], repoRoot);

    await execGit(["checkout", "feature/cli-failure"], repoRoot);

    const tsxPath = path.resolve(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
    const cliPath = path.resolve(process.cwd(), "product-tools", "src", "cli", "reconcile-events.ts");

    await expect(
      execFileAsync(process.execPath, [tsxPath, cliPath, "--base", "main"], { cwd: repoRoot }),
    ).rejects.toMatchObject({
      code: 1,
      stdout: expect.stringContaining("Reconciliation failed with 1 conflict(s)."),
    });

    const yamlArtifact = await readFile(path.join(repoRoot, "branch-delta", "reconciliation.yaml"), "utf8");
    const markdownArtifact = await readFile(path.join(repoRoot, "branch-delta", "reconciliation.md"), "utf8");
    expect(yamlArtifact).toContain("status: conflicts");
    expect(markdownArtifact).toContain("Manual reconciliation is required before merge.");
  });
});

async function initRepo(prefix: string): Promise<string> {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(repoRoot);

  await execGit(["init", "-b", "main"], repoRoot);
  await execGit(["config", "user.name", "Test User"], repoRoot);
  await execGit(["config", "user.email", "test@example.com"], repoRoot);

  return repoRoot;
}

async function writeBaseRequirementState(repoRoot: string): Promise<void> {
  await writeEvent(repoRoot, "product-events/2026/06/01/EVT-20260601-0001-product-created.yaml", {
    id: "EVT-20260601-0001",
    type: "ProductCreated",
    occurred_at: "2026-06-01T09:00:00.000Z",
    actor: { type: "agent", id: "product_model_steward" },
    payload: {
      product_id: "PROD-001",
      name: "Product Factory",
      description: "Event-sourced product knowledge system for agent-driven software delivery.",
    },
  });
  await writeEvent(repoRoot, "product-events/2026/06/01/EVT-20260601-0002-capability-added.yaml", {
    id: "EVT-20260601-0002",
    type: "CapabilityAdded",
    occurred_at: "2026-06-01T09:01:00.000Z",
    actor: { type: "agent", id: "capability_modeller" },
    payload: {
      capability_id: "CAP-001",
      name: "Reconciliation",
      description: "Reconciles branch events.",
    },
  });
  await writeEvent(repoRoot, "product-events/2026/06/01/EVT-20260601-0003-feature-added.yaml", {
    id: "EVT-20260601-0003",
    type: "FeatureAdded",
    occurred_at: "2026-06-01T09:02:00.000Z",
    actor: { type: "agent", id: "feature_specifier" },
    payload: {
      feature_id: "FEAT-001",
      capability_id: "CAP-001",
      name: "Versioning",
      description: "Versions entities during replay.",
    },
  });
  await writeEvent(repoRoot, "product-events/2026/06/01/EVT-20260601-0004-requirement-added.yaml", {
    id: "EVT-20260601-0004",
    type: "RequirementAdded",
    occurred_at: "2026-06-01T09:03:00.000Z",
    actor: { type: "agent", id: "requirement_analyst" },
    payload: {
      requirement_id: "REQ-001",
      feature_id: "FEAT-001",
      description: "The system shall derive requirement revisions deterministically.",
    },
  });
  await writeEvent(repoRoot, "product-events/2026/06/01/EVT-20260601-0005-acceptance-criterion-added.yaml", {
    id: "EVT-20260601-0005",
    type: "AcceptanceCriterionAdded",
    occurred_at: "2026-06-01T09:04:00.000Z",
    actor: { type: "agent", id: "requirement_analyst" },
    payload: {
      acceptance_criterion_id: "AC-001",
      requirement_id: "REQ-001",
      text: "Given accepted events, when replay runs, then requirement revisions are deterministic.",
    },
  });
}

async function writeEvent(repoRoot: string, relativePath: string, event: ProductEvent): Promise<void> {
  const filePath = path.join(repoRoot, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, YAML.stringify(event), "utf8");
}

async function execGit(args: string[], cwd: string): Promise<void> {
  await execFileAsync("git", args, { cwd });
}







