import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { deriveWorkPackages } from "../src/work-packages/deriveWorkPackages.js";
import { writeWorkPackageArtifacts } from "../src/work-packages/writeWorkPackageArtifacts.js";

const execFileAsync = promisify(execFile);
const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("deriveWorkPackages", () => {
// AC: AC-024
  it("groups changed scope under one feature into a deterministic work package", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "derive-work-packages-single-feature-"));
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
      "  description: Existing capability.",
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
      "  description: Existing feature.",
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
      "  description: The system shall support the first slice.",
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
      "  text: Given the first slice, when it runs, then it succeeds.",
    ]);

    await execGit(["add", "."], repoRoot);
    await execGit(["commit", "-m", "Base branch state"], repoRoot);
    await execGit(["checkout", "-b", "feature/work-package-one-feature"], repoRoot);

    const testFile = path.join(repoRoot, "tests", "example.test.ts");
    await mkdir(path.dirname(testFile), { recursive: true });
    await writeFile(testFile, [
      "// AC: AC-002",
      'it("covers the second acceptance criterion", async () => {',
      "  expect(true).toBe(true);",
      "});",
      "",
    ].join("\n"), "utf8");

    await writeEvent(repoRoot, "product-events/2026/06/01/EVT-20260601-0006-requirement-added.yaml", [
      "id: EVT-20260601-0006",
      "type: RequirementAdded",
      "occurred_at: 2026-06-01T09:05:00.000Z",
      "actor:",
      "  type: agent",
      "  id: requirement_analyst",
      "payload:",
      "  requirement_id: REQ-002",
      "  feature_id: FEAT-001",
      "  description: The system shall support the second slice.",
    ]);
    await writeEvent(repoRoot, "product-events/2026/06/01/EVT-20260601-0007-acceptance-criterion-added.yaml", [
      "id: EVT-20260601-0007",
      "type: AcceptanceCriterionAdded",
      "occurred_at: 2026-06-01T09:06:00.000Z",
      "actor:",
      "  type: agent",
      "  id: requirement_analyst",
      "payload:",
      "  acceptance_criterion_id: AC-002",
      "  requirement_id: REQ-002",
      "  text: Given the second slice, when it runs, then it succeeds.",
    ]);
    await writeEvent(repoRoot, "product-events/2026/06/01/EVT-20260601-0008-test-created.yaml", [
      "id: EVT-20260601-0008",
      "type: TestCreated",
      "occurred_at: 2026-06-01T09:07:00.000Z",
      "actor:",
      "  type: agent",
      "  id: test_agent",
      "payload:",
      "  test_id: TEST-001",
      "  acceptance_criterion_id: AC-002",
      `  file_path: ${testFile.replaceAll("\\", "/")}`,
      "  test_name: covers the second acceptance criterion",
    ]);

    const report = await deriveWorkPackages({
      baseBranch: "main",
      cwd: repoRoot,
    });

    expect(report).toEqual({
      base_branch: "main",
      current_branch: "feature/work-package-one-feature",
      product_id: "PROD-001",
      source_branch_delta: {
        branch_only_event_count: 3,
        change_categories: ["extend", "verify"],
      },
      work_packages: [
        {
          work_package_id: "WP-001",
          title: "Evolve FEAT-001 Feature A",
          change_summary: ["add requirements", "add acceptance criteria", "add tests"],
          capability_ids: ["CAP-001"],
          feature_ids: ["FEAT-001"],
          requirement_ids: ["REQ-002"],
          acceptance_criterion_ids: ["AC-002"],
          test_ids: ["TEST-001"],
          depends_on: [],
          rationale: "All scoped changes roll up to FEAT-001, so they are grouped into one coherent feature-level implementation slice under CAP-001.",
        },
      ],
    });
  });

// AC: AC-025
  it("writes deterministic work-package artifacts for multiple derived packages", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "derive-work-packages-artifacts-"));
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
      "  description: Existing capability.",
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
      "  description: Existing feature A.",
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
      "  description: The system shall support feature A.",
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
      "  text: Given feature A, when it runs, then it succeeds.",
    ]);
    await writeEvent(repoRoot, "product-events/2026/06/01/EVT-20260601-0006-feature-added.yaml", [
      "id: EVT-20260601-0006",
      "type: FeatureAdded",
      "occurred_at: 2026-06-01T09:05:00.000Z",
      "actor:",
      "  type: agent",
      "  id: feature_specifier",
      "payload:",
      "  feature_id: FEAT-002",
      "  capability_id: CAP-001",
      "  name: Feature B",
      "  description: Existing feature B.",
    ]);
    await writeEvent(repoRoot, "product-events/2026/06/01/EVT-20260601-0007-requirement-added.yaml", [
      "id: EVT-20260601-0007",
      "type: RequirementAdded",
      "occurred_at: 2026-06-01T09:06:00.000Z",
      "actor:",
      "  type: agent",
      "  id: requirement_analyst",
      "payload:",
      "  requirement_id: REQ-002",
      "  feature_id: FEAT-002",
      "  description: The system shall support feature B.",
    ]);
    await writeEvent(repoRoot, "product-events/2026/06/01/EVT-20260601-0008-acceptance-criterion-added.yaml", [
      "id: EVT-20260601-0008",
      "type: AcceptanceCriterionAdded",
      "occurred_at: 2026-06-01T09:07:00.000Z",
      "actor:",
      "  type: agent",
      "  id: requirement_analyst",
      "payload:",
      "  acceptance_criterion_id: AC-002",
      "  requirement_id: REQ-002",
      "  text: Given feature B, when it runs, then it succeeds.",
    ]);

    await execGit(["add", "."], repoRoot);
    await execGit(["commit", "-m", "Base branch state"], repoRoot);
    await execGit(["checkout", "-b", "feature/work-package-artifacts"], repoRoot);

    await writeEvent(repoRoot, "product-events/2026/06/01/EVT-20260601-0009-requirement-added.yaml", [
      "id: EVT-20260601-0009",
      "type: RequirementAdded",
      "occurred_at: 2026-06-01T09:08:00.000Z",
      "actor:",
      "  type: agent",
      "  id: requirement_analyst",
      "payload:",
      "  requirement_id: REQ-003",
      "  feature_id: FEAT-001",
      "  description: The system shall extend feature A.",
    ]);
    await writeEvent(repoRoot, "product-events/2026/06/01/EVT-20260601-0010-acceptance-criterion-added.yaml", [
      "id: EVT-20260601-0010",
      "type: AcceptanceCriterionAdded",
      "occurred_at: 2026-06-01T09:09:00.000Z",
      "actor:",
      "  type: agent",
      "  id: requirement_analyst",
      "payload:",
      "  acceptance_criterion_id: AC-003",
      "  requirement_id: REQ-003",
      "  text: Given the extension, when feature A runs, then the extension is present.",
    ]);
    await writeEvent(repoRoot, "product-events/2026/06/01/EVT-20260601-0011-feature-status-changed.yaml", [
      "id: EVT-20260601-0011",
      "type: FeatureStatusChanged",
      "occurred_at: 2026-06-01T09:10:00.000Z",
      "actor:",
      "  type: agent",
      "  id: product_model_steward",
      "payload:",
      "  feature_id: FEAT-002",
      "  status: implementation_ready",
      "  reason: Scope is ready for delivery.",
    ]);

    const result = await writeWorkPackageArtifacts({
      baseBranch: "main",
      cwd: repoRoot,
    });

    expect(result.report.work_packages).toEqual([
      {
        work_package_id: "WP-001",
        title: "Evolve FEAT-001 Feature A",
        change_summary: ["add requirements", "add acceptance criteria"],
        capability_ids: ["CAP-001"],
        feature_ids: ["FEAT-001"],
        requirement_ids: ["REQ-003"],
        acceptance_criterion_ids: ["AC-003"],
        test_ids: [],
        depends_on: [],
        rationale: "All scoped changes roll up to FEAT-001, so they are grouped into one coherent feature-level implementation slice under CAP-001.",
      },
      {
        work_package_id: "WP-002",
        title: "Advance FEAT-002 Feature B readiness",
        change_summary: ["feature status transition"],
        capability_ids: ["CAP-001"],
        feature_ids: ["FEAT-002"],
        requirement_ids: ["REQ-002"],
        acceptance_criterion_ids: ["AC-002"],
        test_ids: [],
        depends_on: [],
        rationale: "All scoped changes roll up to FEAT-002, so they are grouped into one coherent feature-level implementation slice under CAP-001.",
      },
    ]);

    expect(path.dirname(result.yamlPath)).toBe(path.join(repoRoot, "branch-delta"));
    expect(path.dirname(result.markdownPath)).toBe(path.join(repoRoot, "branch-delta"));

    const yaml = await readFile(result.yamlPath, "utf8");
    expect(yaml).toContain("# Generated from /product-events.");
    expect(yaml).toContain("work_package_id: WP-001");
    expect(yaml).toContain("title: Evolve FEAT-001 Feature A");
    expect(yaml).toContain("work_package_id: WP-002");

    const markdown = await readFile(result.markdownPath, "utf8");
    expect(markdown).toContain("<!-- Generated from /product-events. -->");
    expect(markdown).toContain("# feature/work-package-artifacts — Work Packages");
    expect(markdown).toContain("## WP-001 — Evolve FEAT-001 Feature A");
    expect(markdown).toContain("## WP-002 — Advance FEAT-002 Feature B readiness");
    expect(markdown).toContain("- Acceptance criteria: `AC-003`");
    expect(markdown).toContain("- Rationale: All scoped changes roll up to FEAT-002, so they are grouped into one coherent feature-level implementation slice under CAP-001.");
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


