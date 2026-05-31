import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createCapability } from "../src/commands/createCapability.js";
import { createFeature } from "../src/commands/createFeature.js";
import { createProduct } from "../src/commands/createProduct.js";
import { setFeatureStatus } from "../src/commands/setFeatureStatus.js";
import { validateEvents } from "../src/validation/validateEvents.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("setFeatureStatus", () => {
// AC: AC-016
  it("records a feature status transition and projects readiness metadata", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "set-feature-status-"));
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
      name: "Feature with status",
      description: "Tracks readiness.",
      requirementDescription: "The system shall expose feature readiness.",
      acceptanceCriterionTexts: [
        "Given an existing feature, when its status changes, then the projected model shows the new status.",
      ],
      occurredAt: "2026-05-31T09:10:00.000Z",
      eventsRoot,
      modelRoot,
    });

    const result = await setFeatureStatus({
      featureId: "FEAT-001",
      status: "implementation_ready",
      reason: "Specification is complete and ready for delivery.",
      changeProposalId: "CHG-006",
      occurredAt: "2026-06-01T10:00:00.000Z",
      eventsRoot,
      modelRoot,
    });

    expect(result.featureId).toBe("FEAT-001");
    expect(result.status).toBe("implementation_ready");
    expect(result.eventId).toBe("EVT-20260601-0001");

    const validation = await validateEvents(eventsRoot);
    expect(validation.errors).toEqual([]);
    expect(validation.events).toHaveLength(6);

    const featureYaml = await readFile(path.join(modelRoot, "features", "FEAT-001-feature-with-status.yaml"), "utf8");
    expect(featureYaml).toContain("status: implementation_ready");
    expect(featureYaml).toContain("status_reason: Specification is complete and ready for delivery.");

    const readinessYaml = await readFile(path.join(modelRoot, "indexes", "readiness.yaml"), "utf8");
    expect(readinessYaml).toContain("implementation_ready_features:");
    expect(readinessYaml).toContain("- FEAT-001");

    const projectMarkdown = await readFile(path.join(modelRoot, "project.md"), "utf8");
    expect(projectMarkdown).toContain("### FEAT-001 — Feature with status (implementation_ready)");
    expect(projectMarkdown).toContain("Status reason: Specification is complete and ready for delivery.");
  });
});

