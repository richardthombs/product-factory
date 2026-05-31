import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createCapability } from "../src/commands/createCapability.js";
import { createFeature } from "../src/commands/createFeature.js";
import { createProduct } from "../src/commands/createProduct.js";
import { validateEvents } from "../src/validation/validateEvents.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("createFeature", () => {
// AC: AC-003, AC-004
  it("allocates ids automatically and creates multiple acceptance criteria", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "create-feature-"));
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

    const result = await createFeature({
      capabilityId: "CAP-001",
      name: "Export requirements to Markdown",
      description: "Exports structured requirements as Markdown.",
      requirementDescription: "The system shall export generated requirements as Markdown.",
      acceptanceCriterionTexts: [
        "Given a generated requirement set, when the user exports to Markdown, then a Markdown document is returned.",
        "Given exported Markdown, when it is opened in a Markdown viewer, then headings and requirement content are preserved.",
      ],
      actorId: "feature_specifier",
      actorType: "agent",
      changeProposalId: "CHG-002",
      eventsRoot,
      modelRoot,
      occurredAt: "2026-06-01T10:00:00.000Z",
    });

    expect(result.featureId).toBe("FEAT-001");
    expect(result.requirementId).toBe("REQ-001");
    expect(result.acceptanceCriterionIds).toEqual(["AC-001", "AC-002"]);
    expect(result.eventIds).toEqual([
      "EVT-20260601-0001",
      "EVT-20260601-0002",
      "EVT-20260601-0003",
      "EVT-20260601-0004",
    ]);

    const validation = await validateEvents(eventsRoot);
    expect(validation.errors).toEqual([]);
    expect(validation.events).toHaveLength(6);

    const datedEventFiles = await readdir(path.join(eventsRoot, "2026", "06", "01"));
    expect(datedEventFiles).toEqual([
      "EVT-20260601-0001-feature-added.yaml",
      "EVT-20260601-0002-requirement-added.yaml",
      "EVT-20260601-0003-acceptance-criterion-added.yaml",
      "EVT-20260601-0004-acceptance-criterion-added.yaml",
    ]);

    const traceabilityMatrix = await readFile(path.join(modelRoot, "indexes", "traceability-matrix.yaml"), "utf8");
    expect(traceabilityMatrix).toContain("feature_id: FEAT-001");
    expect(traceabilityMatrix).toContain("requirement_id: REQ-001");
    expect(traceabilityMatrix).toContain("acceptance_criterion_id: AC-001");
    expect(traceabilityMatrix).toContain("acceptance_criterion_id: AC-002");
  });
});

