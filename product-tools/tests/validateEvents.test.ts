import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { summarizeEvents, validateEvents } from "../src/validation/validateEvents.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("validateEvents", () => {
// AC: AC-005
  it("validates the current self-described event stream", async () => {
    const root = path.resolve(process.cwd(), "product-events");
    const result = await validateEvents(root);

    expect(result.errors).toEqual([]);
    expect(result.events).toHaveLength(126);
    expect(summarizeEvents(result.events)).toEqual({
      ProductCreated: 1,
      CapabilityAdded: 2,
      FeatureAdded: 15,
      RequirementAdded: 20,
      AcceptanceCriterionAdded: 34,
      FeatureChanged: 2,
      RequirementChanged: 4,
      AcceptanceCriterionChanged: 9,
      FeatureMovedToCapability: 0,
      FeatureDeprecated: 0,
      FeatureStatusChanged: 0,
      CapabilityStatusChanged: 0,
      TestCreated: 39,
    });
  });

// AC: AC-032
  it("accepts valid concurrency preconditions that reference prior events for the same entity", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "validate-events-concurrency-valid-"));
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
      path.join(eventsRoot, "2026", "06", "01", "EVT-20260601-0002-capability-added.yaml"),
      [
        "id: EVT-20260601-0002",
        "type: CapabilityAdded",
        "occurred_at: 2026-06-01T09:01:00.000Z",
        "actor:",
        "  type: agent",
        "  id: capability_modeller",
        "payload:",
        "  capability_id: CAP-001",
        "  name: Validation",
        "  description: Validates product events.",
        "",
      ].join("\n"),
      "utf8",
    );

    await writeFile(
      path.join(eventsRoot, "2026", "06", "01", "EVT-20260601-0003-feature-added.yaml"),
      [
        "id: EVT-20260601-0003",
        "type: FeatureAdded",
        "occurred_at: 2026-06-01T09:02:00.000Z",
        "actor:",
        "  type: agent",
        "  id: feature_specifier",
        "metadata:",
        "  concurrency:",
        "    preconditions:",
        "      - entity_type: capability",
        "        entity_id: CAP-001",
        "        expected_revision: 1",
        "        expected_last_entity_event_id: EVT-20260601-0002",
        "payload:",
        "  feature_id: FEAT-001",
        "  capability_id: CAP-001",
        "  name: Versioning",
        "  description: Versions accepted entities.",
        "",
      ].join("\n"),
      "utf8",
    );

    const result = await validateEvents(eventsRoot);

    expect(result.errors).toEqual([]);
  });

// AC: AC-033
  it("reports invalid concurrency preconditions that reference missing entities or unrelated last events", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "validate-events-concurrency-invalid-"));
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
      path.join(eventsRoot, "2026", "06", "01", "EVT-20260601-0002-capability-added.yaml"),
      [
        "id: EVT-20260601-0002",
        "type: CapabilityAdded",
        "occurred_at: 2026-06-01T09:01:00.000Z",
        "actor:",
        "  type: agent",
        "  id: capability_modeller",
        "payload:",
        "  capability_id: CAP-001",
        "  name: Validation",
        "  description: Validates product events.",
        "",
      ].join("\n"),
      "utf8",
    );

    await writeFile(
      path.join(eventsRoot, "2026", "06", "01", "EVT-20260601-0003-feature-added.yaml"),
      [
        "id: EVT-20260601-0003",
        "type: FeatureAdded",
        "occurred_at: 2026-06-01T09:02:00.000Z",
        "actor:",
        "  type: agent",
        "  id: feature_specifier",
        "metadata:",
        "  concurrency:",
        "    preconditions:",
        "      - entity_type: capability",
        "        entity_id: CAP-999",
        "        expected_revision: 1",
        "      - entity_type: capability",
        "        entity_id: CAP-001",
        "        expected_revision: 1",
        "        expected_last_entity_event_id: EVT-20260601-0001",
        "payload:",
        "  feature_id: FEAT-001",
        "  capability_id: CAP-001",
        "  name: Versioning",
        "  description: Versions accepted entities.",
        "",
      ].join("\n"),
      "utf8",
    );

    const result = await validateEvents(eventsRoot);

    expect(result.errors).toEqual([
      {
        path: path.join(eventsRoot, "2026", "06", "01", "EVT-20260601-0003-feature-added.yaml"),
        message: "Concurrency precondition references missing capability 'CAP-999'",
      },
      {
        path: path.join(eventsRoot, "2026", "06", "01", "EVT-20260601-0003-feature-added.yaml"),
        message: "Concurrency precondition expected_last_entity_event_id 'EVT-20260601-0001' does not reference a prior event affecting capability 'CAP-001'",
      },
    ]);
  });
});



