import { mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createProduct } from "../src/commands/createProduct.js";
import { validateEvents } from "../src/validation/validateEvents.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("createProduct", () => {
// AC: AC-001
  it("creates the initial product in an empty event store and rebuilds the model", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "create-product-"));
    const eventsRoot = path.join(tempRoot, "product-events");
    const modelRoot = path.join(tempRoot, "product-model");
    tempDirs.push(tempRoot);

    await mkdir(eventsRoot, { recursive: true });

    const result = await createProduct({
      name: "Product Factory",
      description: "Event-sourced product knowledge system for agent-driven software delivery.",
      actorId: "product_model_steward",
      actorType: "agent",
      changeProposalId: "CHG-001",
      occurredAt: "2026-05-31T09:00:00.000Z",
      eventsRoot,
      modelRoot,
    });

    expect(result.productId).toBe("PROD-001");
    expect(result.eventId).toBe("EVT-20260531-0001");

    const validation = await validateEvents(eventsRoot);
    expect(validation.errors).toEqual([]);
    expect(validation.events).toHaveLength(1);

    const datedEventFiles = await readdir(path.join(eventsRoot, "2026", "05", "31"));
    expect(datedEventFiles).toEqual(["EVT-20260531-0001-product-created.yaml"]);

    const productYaml = await readFile(path.join(modelRoot, "product.yaml"), "utf8");
    expect(productYaml).toContain("id: PROD-001");
    expect(productYaml).toContain("capability_ids: []");
  });
});

