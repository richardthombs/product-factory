import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createCapability } from "../src/commands/createCapability.js";
import { createFeature } from "../src/commands/createFeature.js";
import { createProduct } from "../src/commands/createProduct.js";
import { deprecateFeature } from "../src/commands/deprecateFeature.js";
import { validateEvents } from "../src/validation/validateEvents.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("deprecateFeature", () => {
// AC: AC-015
  it("marks an existing feature as deprecated and projects the deprecation metadata", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "deprecate-feature-"));
    const eventsRoot = path.join(tempRoot, "product-events");
    const modelRoot = path.join(tempRoot, "product-model");
    tempDirs.push(tempRoot);

    await createProduct({
      name: "Product Factory",
      description: "Event-sourced product knowledge system for agent-driven software delivery.",
      occurredAt: "2026-05-31T09:00:00.000Z",
      eventsRoot,
      modelRoot,
    });

    await createCapability({
      name: "Capability A",
      description: "First capability.",
      occurredAt: "2026-05-31T09:05:00.000Z",
      eventsRoot,
      modelRoot,
    });

    await createFeature({
      capabilityId: "CAP-001",
      name: "Feature to deprecate",
      description: "Will be retired.",
      requirementDescription: "The system shall support feature retirement.",
      acceptanceCriterionTexts: [
        "Given an existing feature, when it is deprecated, then the projected model marks it as deprecated.",
      ],
      occurredAt: "2026-05-31T09:10:00.000Z",
      eventsRoot,
      modelRoot,
    });

    const result = await deprecateFeature({
      featureId: "FEAT-001",
      reason: "Replaced by a new workflow.",
      changeProposalId: "CHG-006",
      occurredAt: "2026-06-01T10:00:00.000Z",
      eventsRoot,
      modelRoot,
    });

    expect(result.featureId).toBe("FEAT-001");
    expect(result.eventId).toBe("EVT-20260601-0001");

    const validation = await validateEvents(eventsRoot);
    expect(validation.errors).toEqual([]);
    expect(validation.events).toHaveLength(6);

    const featureYaml = await readFile(path.join(modelRoot, "features", "FEAT-001-feature-to-deprecate.yaml"), "utf8");
    expect(featureYaml).toContain("status: deprecated");
    expect(featureYaml).toContain("deprecated_reason: Replaced by a new workflow.");

    const readinessYaml = await readFile(path.join(modelRoot, "indexes", "readiness.yaml"), "utf8");
    expect(readinessYaml).toContain("feature_id: FEAT-001");
    expect(readinessYaml).toContain("status: deprecated");

    const projectMarkdown = await readFile(path.join(modelRoot, "project.md"), "utf8");
    expect(projectMarkdown).toContain("### FEAT-001 — Feature to deprecate (deprecated)");
    expect(projectMarkdown).toContain("Deprecated reason: Replaced by a new workflow.");
  });
});

