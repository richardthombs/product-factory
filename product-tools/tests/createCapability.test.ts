import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createCapability } from "../src/commands/createCapability.js";
import { createProduct } from "../src/commands/createProduct.js";
import { validateEvents } from "../src/validation/validateEvents.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("createCapability", () => {
// AC: AC-002
  it("allocates the next capability id and rebuilds the model", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "create-capability-"));
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

    const result = await createCapability({
      name: "Specify product behaviour",
      description: "Enables users to define expected product behaviour clearly and testably.",
      actorId: "capability_modeller",
      actorType: "agent",
      changeProposalId: "CHG-002",
      occurredAt: "2026-06-01T10:00:00.000Z",
      eventsRoot,
      modelRoot,
    });

    expect(result.capabilityId).toBe("CAP-001");
    expect(result.eventId).toBe("EVT-20260601-0001");

    const validation = await validateEvents(eventsRoot);
    expect(validation.errors).toEqual([]);
    expect(validation.events).toHaveLength(2);

    const datedEventFiles = await readdir(path.join(eventsRoot, "2026", "06", "01"));
    expect(datedEventFiles).toEqual(["EVT-20260601-0001-capability-added.yaml"]);

    const capabilityYaml = await readFile(
      path.join(modelRoot, "capabilities", "CAP-001-specify-product-behaviour.yaml"),
      "utf8",
    );
    expect(capabilityYaml).toContain("id: CAP-001");
    expect(capabilityYaml).toContain("feature_ids: []");
  });
});

