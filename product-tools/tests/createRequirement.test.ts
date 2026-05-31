import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createCapability } from "../src/commands/createCapability.js";
import { createFeature } from "../src/commands/createFeature.js";
import { createProduct } from "../src/commands/createProduct.js";
import { createRequirement } from "../src/commands/createRequirement.js";
import { validateEvents } from "../src/validation/validateEvents.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("createRequirement", () => {
// AC: AC-010, AC-011
  it("allocates ids automatically and creates acceptance criteria for an existing feature", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "create-requirement-"));
    const eventsRoot = path.join(tempRoot, "product-events");
    const modelRoot = path.join(tempRoot, "product-model");
    tempDirs.push(tempRoot);

    await createProduct({
      name: "Product Factory",
      description: "Event-sourced product knowledge system for agent-driven software delivery.",
      actorId: "product_model_steward",
      actorType: "agent",
      occurredAt: "2026-05-31T09:00:00.000Z",
      eventsRoot,
      modelRoot,
    });

    await createCapability({
      name: "Manage product model structure",
      description: "Enables users to define and extend the core structure of the product model.",
      actorId: "capability_modeller",
      actorType: "agent",
      occurredAt: "2026-05-31T09:05:00.000Z",
      eventsRoot,
      modelRoot,
    });

    await createFeature({
      capabilityId: "CAP-001",
      name: "Export requirements to Markdown",
      description: "Exports structured requirements as Markdown.",
      requirementDescription: "The system shall export generated requirements as Markdown.",
      acceptanceCriterionTexts: [
        "Given a generated requirement set, when the user exports to Markdown, then a Markdown document is returned.",
      ],
      actorId: "feature_specifier",
      actorType: "agent",
      occurredAt: "2026-05-31T09:10:00.000Z",
      eventsRoot,
      modelRoot,
    });

    const result = await createRequirement({
      featureId: "FEAT-001",
      description: "The system shall preserve heading structure when exporting requirements as Markdown.",
      acceptanceCriterionTexts: [
        "Given an exported Markdown document, when it is opened in a Markdown viewer, then headings are preserved.",
        "Given requirement content with lists, when it is exported to Markdown, then list structure is preserved.",
      ],
      actorId: "requirement_analyst",
      actorType: "agent",
      changeProposalId: "CHG-003",
      occurredAt: "2026-06-01T10:00:00.000Z",
      eventsRoot,
      modelRoot,
    });

    expect(result.requirementId).toBe("REQ-002");
    expect(result.acceptanceCriterionIds).toEqual(["AC-002", "AC-003"]);
    expect(result.eventIds).toEqual([
      "EVT-20260601-0001",
      "EVT-20260601-0002",
      "EVT-20260601-0003",
    ]);

    const validation = await validateEvents(eventsRoot);
    expect(validation.errors).toEqual([]);
    expect(validation.events).toHaveLength(8);

    const datedEventFiles = await readdir(path.join(eventsRoot, "2026", "06", "01"));
    expect(datedEventFiles).toEqual([
      "EVT-20260601-0001-requirement-added.yaml",
      "EVT-20260601-0002-acceptance-criterion-added.yaml",
      "EVT-20260601-0003-acceptance-criterion-added.yaml",
    ]);

    const featureYaml = await readFile(
      path.join(modelRoot, "features", "FEAT-001-export-requirements-to-markdown.yaml"),
      "utf8",
    );
    expect(featureYaml).toContain("requirement_ids:");
    expect(featureYaml).toContain("- REQ-001");
    expect(featureYaml).toContain("- REQ-002");

    const traceabilityMatrix = await readFile(path.join(modelRoot, "indexes", "traceability-matrix.yaml"), "utf8");
    expect(traceabilityMatrix).toContain("requirement_id: REQ-002");
    expect(traceabilityMatrix).toContain("acceptance_criterion_id: AC-002");
    expect(traceabilityMatrix).toContain("acceptance_criterion_id: AC-003");
  });
});

