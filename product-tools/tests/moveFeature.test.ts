import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createCapability } from "../src/commands/createCapability.js";
import { createFeature } from "../src/commands/createFeature.js";
import { createProduct } from "../src/commands/createProduct.js";
import { moveFeature } from "../src/commands/moveFeature.js";
import { validateEvents } from "../src/validation/validateEvents.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("moveFeature", () => {
// AC: AC-014
  it("moves an existing feature to another capability and projects the updated hierarchy", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "move-feature-"));
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

    await createCapability({
      name: "Capability B",
      description: "Second capability.",
      occurredAt: "2026-05-31T09:10:00.000Z",
      eventsRoot,
      modelRoot,
    });

    await createFeature({
      capabilityId: "CAP-001",
      name: "Feature to move",
      description: "Moves between capabilities.",
      requirementDescription: "The system shall allow feature relocation.",
      acceptanceCriterionTexts: [
        "Given an existing feature and target capability, when the move is proposed, then the feature appears under the target capability.",
      ],
      occurredAt: "2026-05-31T09:15:00.000Z",
      eventsRoot,
      modelRoot,
    });

    const result = await moveFeature({
      featureId: "FEAT-001",
      capabilityId: "CAP-002",
      changeProposalId: "CHG-006",
      occurredAt: "2026-06-01T10:00:00.000Z",
      eventsRoot,
      modelRoot,
    });

    expect(result.featureId).toBe("FEAT-001");
    expect(result.capabilityId).toBe("CAP-002");
    expect(result.eventId).toBe("EVT-20260601-0001");

    const validation = await validateEvents(eventsRoot);
    expect(validation.errors).toEqual([]);
    expect(validation.events).toHaveLength(7);

    const featureYaml = await readFile(path.join(modelRoot, "features", "FEAT-001-feature-to-move.yaml"), "utf8");
    expect(featureYaml).toContain("capability_id: CAP-002");

    const capabilityOneYaml = await readFile(path.join(modelRoot, "capabilities", "CAP-001-capability-a.yaml"), "utf8");
    expect(capabilityOneYaml).toContain("feature_ids: []");

    const capabilityTwoYaml = await readFile(path.join(modelRoot, "capabilities", "CAP-002-capability-b.yaml"), "utf8");
    expect(capabilityTwoYaml).toContain("- FEAT-001");

    const traceabilityMatrix = await readFile(path.join(modelRoot, "indexes", "traceability-matrix.yaml"), "utf8");
    expect(traceabilityMatrix).toContain("capability_id: CAP-002");
    expect(traceabilityMatrix).toContain("feature_id: FEAT-001");
  });
});

