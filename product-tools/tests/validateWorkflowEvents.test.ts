import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { validateEvents } from "../src/validation/validateEvents.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("validateEvents workflow events", () => {
  it("reports missing references for move, deprecate, and status events", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "validate-workflow-events-"));
    const eventsRoot = path.join(tempRoot, "product-events");
    tempDirs.push(tempRoot);

    await mkdir(path.join(eventsRoot, "2026", "06", "01"), { recursive: true });

    const files: Array<[string, string[]]> = [
      ["EVT-20260601-0001-product-created.yaml", [
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
      ]],
      ["EVT-20260601-0002-feature-moved-to-capability.yaml", [
        "id: EVT-20260601-0002",
        "type: FeatureMovedToCapability",
        "occurred_at: 2026-06-01T09:01:00.000Z",
        "actor:",
        "  type: agent",
        "  id: product_model_steward",
        "payload:",
        "  feature_id: FEAT-999",
        "  capability_id: CAP-999",
      ]],
      ["EVT-20260601-0003-feature-deprecated.yaml", [
        "id: EVT-20260601-0003",
        "type: FeatureDeprecated",
        "occurred_at: 2026-06-01T09:02:00.000Z",
        "actor:",
        "  type: agent",
        "  id: product_model_steward",
        "payload:",
        "  feature_id: FEAT-999",
        "  reason: Replaced.",
      ]],
      ["EVT-20260601-0004-feature-status-changed.yaml", [
        "id: EVT-20260601-0004",
        "type: FeatureStatusChanged",
        "occurred_at: 2026-06-01T09:03:00.000Z",
        "actor:",
        "  type: agent",
        "  id: product_model_steward",
        "payload:",
        "  feature_id: FEAT-999",
        "  status: implementation_ready",
      ]],
      ["EVT-20260601-0005-capability-status-changed.yaml", [
        "id: EVT-20260601-0005",
        "type: CapabilityStatusChanged",
        "occurred_at: 2026-06-01T09:04:00.000Z",
        "actor:",
        "  type: agent",
        "  id: product_model_steward",
        "payload:",
        "  capability_id: CAP-999",
        "  status: scoped",
      ]],
    ];

    await Promise.all(files.map(([name, lines]) => writeFile(path.join(eventsRoot, "2026", "06", "01", name), `${lines.join("\n")}\n`, "utf8")));

    const result = await validateEvents(eventsRoot);
    expect(result.errors).toEqual([
      {
        path: path.join(eventsRoot, "2026", "06", "01", "EVT-20260601-0002-feature-moved-to-capability.yaml"),
        message: "FeatureMovedToCapability references missing feature 'FEAT-999'",
      },
      {
        path: path.join(eventsRoot, "2026", "06", "01", "EVT-20260601-0002-feature-moved-to-capability.yaml"),
        message: "FeatureMovedToCapability references missing capability 'CAP-999'",
      },
      {
        path: path.join(eventsRoot, "2026", "06", "01", "EVT-20260601-0003-feature-deprecated.yaml"),
        message: "FeatureDeprecated references missing feature 'FEAT-999'",
      },
      {
        path: path.join(eventsRoot, "2026", "06", "01", "EVT-20260601-0004-feature-status-changed.yaml"),
        message: "FeatureStatusChanged references missing feature 'FEAT-999'",
      },
      {
        path: path.join(eventsRoot, "2026", "06", "01", "EVT-20260601-0005-capability-status-changed.yaml"),
        message: "CapabilityStatusChanged references missing capability 'CAP-999'",
      },
    ]);
  });
});
