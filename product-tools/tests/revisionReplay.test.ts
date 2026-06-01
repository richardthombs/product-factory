import { describe, expect, it } from "vitest";
import { replayEvents, requireEntityRevision } from "../src/projection/replay.js";
import type { ProductEvent } from "../src/schemas/events.js";
import type { LoadedEvent } from "../src/validation/types.js";

describe("replay entity revisions", () => {
// AC: AC-034
  it("derives deterministic revisions and last entity event ids from replay", () => {
    const events: LoadedEvent[] = [
      loaded({
        id: "EVT-20260601-0001",
        type: "ProductCreated",
        occurred_at: "2026-06-01T09:00:00.000Z",
        actor: { type: "agent", id: "product_model_steward" },
        payload: {
          product_id: "PROD-001",
          name: "Product Factory",
          description: "Event-sourced product knowledge system for agent-driven software delivery.",
        },
      }),
      loaded({
        id: "EVT-20260601-0002",
        type: "CapabilityAdded",
        occurred_at: "2026-06-01T09:01:00.000Z",
        actor: { type: "agent", id: "capability_modeller" },
        payload: {
          capability_id: "CAP-001",
          name: "Projection",
          description: "Projects product state.",
        },
      }),
      loaded({
        id: "EVT-20260601-0003",
        type: "FeatureAdded",
        occurred_at: "2026-06-01T09:02:00.000Z",
        actor: { type: "agent", id: "feature_specifier" },
        payload: {
          feature_id: "FEAT-001",
          capability_id: "CAP-001",
          name: "Replay revisions",
          description: "Derives entity revisions.",
        },
      }),
      loaded({
        id: "EVT-20260601-0004",
        type: "RequirementAdded",
        occurred_at: "2026-06-01T09:03:00.000Z",
        actor: { type: "agent", id: "requirement_analyst" },
        payload: {
          requirement_id: "REQ-001",
          feature_id: "FEAT-001",
          description: "The system shall derive deterministic revisions.",
        },
      }),
      loaded({
        id: "EVT-20260601-0005",
        type: "AcceptanceCriterionAdded",
        occurred_at: "2026-06-01T09:04:00.000Z",
        actor: { type: "agent", id: "requirement_analyst" },
        payload: {
          acceptance_criterion_id: "AC-001",
          requirement_id: "REQ-001",
          text: "Given accepted events, when replay runs, then entity revisions are deterministic.",
        },
      }),
      loaded({
        id: "EVT-20260601-0006",
        type: "FeatureChanged",
        occurred_at: "2026-06-01T09:05:00.000Z",
        actor: { type: "agent", id: "feature_specifier" },
        payload: {
          feature_id: "FEAT-001",
          description: "Derives entity revisions and provenance.",
        },
      }),
      loaded({
        id: "EVT-20260601-0007",
        type: "TestCreated",
        occurred_at: "2026-06-01T09:06:00.000Z",
        actor: { type: "agent", id: "test_agent" },
        payload: {
          test_id: "TEST-001",
          acceptance_criterion_id: "AC-001",
          file_path: "product-tools/tests/revisionReplay.test.ts",
          test_name: "derives deterministic revisions and last entity event ids from replay",
        },
      }),
    ];

    const state = replayEvents(events);

    expect(requireEntityRevision(state, "product", "PROD-001")).toMatchObject({
      revision: 1,
      lastEventId: "EVT-20260601-0001",
    });
    expect(requireEntityRevision(state, "capability", "CAP-001")).toMatchObject({
      revision: 2,
      lastEventId: "EVT-20260601-0003",
    });
    expect(requireEntityRevision(state, "feature", "FEAT-001")).toMatchObject({
      revision: 3,
      lastEventId: "EVT-20260601-0006",
    });
    expect(requireEntityRevision(state, "requirement", "REQ-001")).toMatchObject({
      revision: 2,
      lastEventId: "EVT-20260601-0005",
    });
    expect(requireEntityRevision(state, "acceptance_criterion", "AC-001")).toMatchObject({
      revision: 2,
      lastEventId: "EVT-20260601-0007",
    });
    expect(requireEntityRevision(state, "test", "TEST-001")).toMatchObject({
      revision: 1,
      lastEventId: "EVT-20260601-0007",
    });
  });
});

function loaded(event: ProductEvent): LoadedEvent {
  return {
    path: `/virtual/${event.id}.yaml`,
    event,
  };
}

