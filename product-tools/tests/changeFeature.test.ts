import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { changeFeature } from "../src/commands/changeFeature.js";
import { createCapability } from "../src/commands/createCapability.js";
import { createFeature } from "../src/commands/createFeature.js";
import { createProduct } from "../src/commands/createProduct.js";
import { validateEvents } from "../src/validation/validateEvents.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("changeFeature", () => {
// AC: AC-026
  it("records a FeatureChanged event and projects the updated feature description", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "change-feature-"));
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
      name: "Validate and project product model",
      description: "Enables users to validate product events and regenerate the current-state product model.",
      actorId: "capability_modeller",
      actorType: "agent",
      occurredAt: "2026-05-31T09:05:00.000Z",
      eventsRoot,
      modelRoot,
    });

    await createFeature({
      capabilityId: "CAP-001",
      name: "Report branch delta",
      description: "Reports product events unique to a working branch relative to a base branch.",
      requirementDescription: "The system shall compare the current branch against a base branch and report the product events unique to the current branch.",
      acceptanceCriterionTexts: [
        "Given a working branch with product events not contained in the base branch, when the branch-delta helper is run, then it reports the branch-only product events relative to the base branch.",
      ],
      actorId: "feature_specifier",
      actorType: "agent",
      occurredAt: "2026-05-31T09:10:00.000Z",
      eventsRoot,
      modelRoot,
    });

    const result = await changeFeature({
      featureId: "FEAT-001",
      description: "Reports the net product delta between a working branch and a base branch.",
      actorId: "feature_specifier",
      actorType: "agent",
      changeProposalId: "CHG-010",
      occurredAt: "2026-06-01T10:00:00.000Z",
      eventsRoot,
      modelRoot,
    });

    expect(result.featureId).toBe("FEAT-001");
    expect(result.eventId).toBe("EVT-20260601-0001");

    const validation = await validateEvents(eventsRoot);
    expect(validation.errors).toEqual([]);
    expect(validation.events).toHaveLength(6);

    const datedEventFiles = await readdir(path.join(eventsRoot, "2026", "06", "01"));
    expect(datedEventFiles).toEqual([
      "EVT-20260601-0001-feature-changed.yaml",
    ]);

    const featureYaml = await readFile(path.join(modelRoot, "features", "FEAT-001-report-branch-delta.yaml"), "utf8");
    expect(featureYaml).toContain("description: Reports the net product delta between a working branch and a base branch.");

    const projectMarkdown = await readFile(path.join(modelRoot, "project.md"), "utf8");
    expect(projectMarkdown).toContain("### FEAT-001 — Report branch delta");
    expect(projectMarkdown).toContain("Reports the net product delta between a working branch and a base branch.");
  });
});

