import { describe, expect, it } from "vitest";
import { renderBranchDeltaDocument } from "../src/delta/renderBranchDelta.js";
import type { BranchDeltaReport } from "../src/delta/types.js";

describe("renderBranchDeltaDocument", () => {
// AC: AC-023
  it("renders explicit labels for added, changed, moved, deprecated, and status transitions", () => {
    const report: BranchDeltaReport = {
      base_branch: "main",
      current_branch: "feature/example",
      product_id: "PROD-001",
      events_root: "product-events",
      base_event_count: 10,
      current_event_count: 15,
      branch_only_event_count: 5,
      summary: {
        capabilities_added: 0,
        capabilities_changed: 0,
        capabilities_status_changed: 1,
        features_added: 0,
        features_changed: 0,
        features_moved: 1,
        features_deprecated: 1,
        features_status_changed: 1,
        requirements_added: 0,
        requirements_changed: 1,
        acceptance_criteria_added: 0,
        acceptance_criteria_changed: 1,
        tests_added: 0,
      },
      change_categories: ["refine", "reshape", "deprecate", "readiness"],
      branch_only_events: [],
      changed_entities: {
        capabilities: {
          added: [],
          changed: [],
          status_changed: [{ capability_id: "CAP-001", status: "scoped" }],
        },
        features: {
          added: [],
          changed: [],
          moved: [{ feature_id: "FEAT-001", from_capability_id: "CAP-001", to_capability_id: "CAP-002" }],
          deprecated: [{ feature_id: "FEAT-001", reason: "Replaced by FEAT-002." }],
          status_changed: [{ feature_id: "FEAT-001", status: "implementation_ready" }],
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
      },
      impacted_entities: {
        capability_ids: ["CAP-001", "CAP-002"],
        feature_ids: ["FEAT-001"],
        requirement_ids: ["REQ-001"],
        acceptance_criterion_ids: ["AC-001"],
        test_ids: [],
      },
      contextual_changes: {
        capabilities: [
          {
            capability_id: "CAP-002",
            capability_name: "Validate and project product model",
            description: "Enables users to validate product events and regenerate the current-state product model.",
            change_notes: ["status -> scoped"],
            features: [
              {
                feature_id: "FEAT-001",
                feature_name: "Example feature",
                description: "Example feature description.",
                change_notes: [
                  "moved from CAP-001 to CAP-002",
                  "deprecated: Replaced by FEAT-002.",
                  "status -> implementation_ready",
                ],
                requirements: [
                  {
                    requirement_id: "REQ-001",
                    description: "The system shall do something revised.",
                    change_notes: ["changed"],
                    acceptance_criteria: [
                      {
                        acceptance_criterion_id: "AC-001",
                        text: "Given something, when something happens, then something else is true.",
                        change_notes: ["changed"],
                        tests: [{ test_id: "TEST-001" }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    };

    const markdown = renderBranchDeltaDocument(report);

    expect(markdown).toContain("## CAP-002 — Validate and project product model (status: scoped)");
    expect(markdown).toContain("Change details: status changed to scoped");
    expect(markdown).toContain("### FEAT-001 — Example feature (moved; deprecated; status: implementation_ready)");
    expect(markdown).toContain("- Change categories: refinements, structural reshaping, deprecations, readiness transitions");
    expect(markdown).toContain("Change details: moved from CAP-001 to CAP-002; deprecated: Replaced by FEAT-002.; status changed to implementation_ready");
    expect(markdown).toContain("**REQ-001** *(changed)*");
    expect(markdown).toContain("**AC-001** *(changed)*");
  });

  it("renders added entities refined on the branch as added with their latest content", () => {
    const report: BranchDeltaReport = {
      base_branch: "main",
      current_branch: "feature/example",
      product_id: "PROD-001",
      events_root: "product-events",
      base_event_count: 10,
      current_event_count: 14,
      branch_only_event_count: 4,
      summary: {
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
      },
      change_categories: ["extend"],
      branch_only_events: [],
      changed_entities: {
        capabilities: {
          added: [],
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
          added: [{ requirement_id: "REQ-001" }],
          changed: [],
        },
        acceptance_criteria: {
          added: [{ acceptance_criterion_id: "AC-001" }],
          changed: [],
        },
        tests: {
          added: [],
        },
      },
      impacted_entities: {
        capability_ids: ["CAP-001"],
        feature_ids: ["FEAT-001"],
        requirement_ids: ["REQ-001"],
        acceptance_criterion_ids: ["AC-001"],
        test_ids: [],
      },
      contextual_changes: {
        capabilities: [
          {
            capability_id: "CAP-001",
            capability_name: "Validate and project product model",
            description: "Enables users to validate product events and regenerate the current-state product model.",
            change_notes: [],
            features: [
              {
                feature_id: "FEAT-001",
                feature_name: "Example feature",
                description: "Example feature description.",
                change_notes: [],
                requirements: [
                  {
                    requirement_id: "REQ-001",
                    description: "The system shall report gitignored branch-local artifacts.",
                    change_notes: ["added", "changed"],
                    acceptance_criteria: [
                      {
                        acceptance_criterion_id: "AC-001",
                        text: "Given a branch delta, when artifacts are written, then they are stored in a gitignored branch-local folder.",
                        change_notes: ["added", "changed"],
                        tests: [],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    };

    const markdown = renderBranchDeltaDocument(report);

    expect(markdown).toContain("**REQ-001** *(added)*: The system shall report gitignored branch-local artifacts.");
    expect(markdown).toContain("**AC-001** *(added)*: Given a branch delta, when artifacts are written, then they are stored in a gitignored branch-local folder.");
    expect(markdown).not.toContain("**REQ-001** *(added; changed)*");
    expect(markdown).not.toContain("**AC-001** *(added; changed)*");
  });
});

