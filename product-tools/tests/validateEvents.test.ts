import path from "node:path";
import { describe, expect, it } from "vitest";
import { summarizeEvents, validateEvents } from "../src/validation/validateEvents.js";

describe("validateEvents", () => {
// AC: AC-005
  it("validates the current self-described event stream", async () => {
    const root = path.resolve(process.cwd(), "product-events");
    const result = await validateEvents(root);

    expect(result.errors).toEqual([]);
    expect(result.events).toHaveLength(35);
    expect(summarizeEvents(result.events)).toEqual({
      ProductCreated: 1,
      CapabilityAdded: 2,
      FeatureAdded: 7,
      RequirementAdded: 7,
      AcceptanceCriterionAdded: 9,
      TestCreated: 9,
    });
  });
});

