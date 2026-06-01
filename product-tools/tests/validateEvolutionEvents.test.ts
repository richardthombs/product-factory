import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { validateEvents } from "../src/validation/validateEvents.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("validateEvents evolution events", () => {
  it("reports missing references for FeatureChanged, RequirementChanged, and AcceptanceCriterionChanged", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "validate-evolution-events-"));
    const eventsRoot = path.join(tempRoot, "product-events");
    tempDirs.push(tempRoot);

    await mkdir(path.join(eventsRoot, "2026", "06", "01"), { recursive: true });

    await writeFile(
      path.join(eventsRoot, "2026", "06", "01", "EVT-20260601-0001-product-created.yaml"),
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
        "",
      ].join("\n"),
      "utf8",
    );

    await writeFile(
      path.join(eventsRoot, "2026", "06", "01", "EVT-20260601-0002-feature-changed.yaml"),
      [
        "id: EVT-20260601-0002",
        "type: FeatureChanged",
        "occurred_at: 2026-06-01T09:01:00.000Z",
        "actor:",
        "  type: agent",
        "  id: feature_specifier",
        "payload:",
        "  feature_id: FEAT-999",
        "  description: Reports the branch delta in final net form.",
        "",
      ].join("\n"),
      "utf8",
    );

    await writeFile(
      path.join(eventsRoot, "2026", "06", "01", "EVT-20260601-0003-requirement-changed.yaml"),
      [
        "id: EVT-20260601-0003",
        "type: RequirementChanged",
        "occurred_at: 2026-06-01T09:02:00.000Z",
        "actor:",
        "  type: agent",
        "  id: requirement_analyst",
        "payload:",
        "  requirement_id: REQ-999",
        "  description: The system shall preserve heading structure.",
        "",
      ].join("\n"),
      "utf8",
    );

    await writeFile(
      path.join(eventsRoot, "2026", "06", "01", "EVT-20260601-0004-acceptance-criterion-changed.yaml"),
      [
        "id: EVT-20260601-0004",
        "type: AcceptanceCriterionChanged",
        "occurred_at: 2026-06-01T09:03:00.000Z",
        "actor:",
        "  type: agent",
        "  id: requirement_analyst",
        "payload:",
        "  acceptance_criterion_id: AC-999",
        "  text: Given exported Markdown, then headings are preserved.",
        "",
      ].join("\n"),
      "utf8",
    );

    const result = await validateEvents(eventsRoot);

    expect(result.errors).toEqual([
      {
        path: path.join(eventsRoot, "2026", "06", "01", "EVT-20260601-0002-feature-changed.yaml"),
        message: "FeatureChanged references missing feature 'FEAT-999'",
      },
      {
        path: path.join(eventsRoot, "2026", "06", "01", "EVT-20260601-0003-requirement-changed.yaml"),
        message: "RequirementChanged references missing requirement 'REQ-999'",
      },
      {
        path: path.join(eventsRoot, "2026", "06", "01", "EVT-20260601-0004-acceptance-criterion-changed.yaml"),
        message: "AcceptanceCriterionChanged references missing acceptance criterion 'AC-999'",
      },
    ]);
  });
});
