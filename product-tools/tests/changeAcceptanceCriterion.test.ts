import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { changeAcceptanceCriterion } from "../src/commands/changeAcceptanceCriterion.js";
import { createCapability } from "../src/commands/createCapability.js";
import { createFeature } from "../src/commands/createFeature.js";
import { createProduct } from "../src/commands/createProduct.js";
import { validateEvents } from "../src/validation/validateEvents.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("changeAcceptanceCriterion", () => {
// AC: AC-013
  it("records an AcceptanceCriterionChanged event and projects the updated acceptance criterion text", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "change-acceptance-criterion-"));
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

    await createCapability({
      name: "Manage product model structure",
      description: "Enables users to define and extend the core structure of the product model.",
      actorId: "capability_modeller",
      actorType: "agent",
      occurredAt: "2026-05-31T09:05:00.000Z",
      eventsRoot,
      modelRoot,
    });

    await createFeature({
      capabilityId: "CAP-001",
      name: "Export requirements to Markdown",
      description: "Exports structured requirements as Markdown.",
      requirementDescription: "The system shall export generated requirements as Markdown.",
      acceptanceCriterionTexts: [
        "Given a generated requirement set, when the user exports to Markdown, then a Markdown document is returned.",
      ],
      actorId: "feature_specifier",
      actorType: "agent",
      occurredAt: "2026-05-31T09:10:00.000Z",
      eventsRoot,
      modelRoot,
    });

    const result = await changeAcceptanceCriterion({
      acceptanceCriterionId: "AC-001",
      text: "Given generated requirements with headings, when the user exports to Markdown, then heading structure is preserved in the exported document.",
      actorId: "requirement_analyst",
      actorType: "agent",
      changeProposalId: "CHG-004",
      occurredAt: "2026-06-01T10:00:00.000Z",
      eventsRoot,
      modelRoot,
    });

    expect(result.acceptanceCriterionId).toBe("AC-001");
    expect(result.eventId).toBe("EVT-20260601-0001");

    const validation = await validateEvents(eventsRoot);
    expect(validation.errors).toEqual([]);
    expect(validation.events).toHaveLength(6);

    const datedEventFiles = await readdir(path.join(eventsRoot, "2026", "06", "01"));
    expect(datedEventFiles).toEqual([
      "EVT-20260601-0001-acceptance-criterion-changed.yaml",
    ]);

    const acceptanceCriterionYaml = await readFile(path.join(modelRoot, "acceptance-criteria", "AC-001.yaml"), "utf8");
    expect(acceptanceCriterionYaml).toContain("text: Given generated requirements with headings, when the user exports to Markdown, then heading structure is preserved in the exported document.");

    const projectMarkdown = await readFile(path.join(modelRoot, "project.md"), "utf8");
    expect(projectMarkdown).toContain("**AC-001**: Given generated requirements with headings, when the user exports to Markdown, then heading structure is preserved in the exported document.");
  });
});

