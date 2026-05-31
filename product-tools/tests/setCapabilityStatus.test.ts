import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createCapability } from "../src/commands/createCapability.js";
import { createProduct } from "../src/commands/createProduct.js";
import { setCapabilityStatus } from "../src/commands/setCapabilityStatus.js";
import { validateEvents } from "../src/validation/validateEvents.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("setCapabilityStatus", () => {
// AC: AC-017
  it("records a capability status transition and projects the updated capability state", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "set-capability-status-"));
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

    const result = await setCapabilityStatus({
      capabilityId: "CAP-001",
      status: "scoped",
      reason: "Capability boundaries and first feature slices are defined.",
      changeProposalId: "CHG-006",
      occurredAt: "2026-06-01T10:00:00.000Z",
      eventsRoot,
      modelRoot,
    });

    expect(result.capabilityId).toBe("CAP-001");
    expect(result.status).toBe("scoped");
    expect(result.eventId).toBe("EVT-20260601-0001");

    const validation = await validateEvents(eventsRoot);
    expect(validation.errors).toEqual([]);
    expect(validation.events).toHaveLength(3);

    const capabilityYaml = await readFile(path.join(modelRoot, "capabilities", "CAP-001-capability-a.yaml"), "utf8");
    expect(capabilityYaml).toContain("status: scoped");
    expect(capabilityYaml).toContain("status_reason: Capability boundaries and first feature slices are defined.");

    const readinessYaml = await readFile(path.join(modelRoot, "indexes", "readiness.yaml"), "utf8");
    expect(readinessYaml).toContain("capability_id: CAP-001");
    expect(readinessYaml).toContain("status: scoped");

    const projectMarkdown = await readFile(path.join(modelRoot, "project.md"), "utf8");
    expect(projectMarkdown).toContain("## CAP-001 — Capability A (scoped)");
    expect(projectMarkdown).toContain("Status reason: Capability boundaries and first feature slices are defined.");
  });
});

