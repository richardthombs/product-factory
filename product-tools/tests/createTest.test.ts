import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createCapability } from "../src/commands/createCapability.js";
import { createFeature } from "../src/commands/createFeature.js";
import { createProduct } from "../src/commands/createProduct.js";
import { createTest } from "../src/commands/createTest.js";
import { validateEvents } from "../src/validation/validateEvents.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("createTest", () => {
// AC: AC-008
  it("annotates a test and records created test artifacts", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "create-test-"));
    const eventsRoot = path.join(tempRoot, "product-events");
    const modelRoot = path.join(tempRoot, "product-model");
    const testsRoot = path.join(tempRoot, "temp-tests");
    const testFile = path.join(testsRoot, "sample.test.ts");
    tempDirs.push(tempRoot);

    await mkdir(testsRoot, { recursive: true });
    await writeFile(
      testFile,
      [
        'import { describe, it, expect } from "vitest";',
        "",
        'describe("sample", () => {',
        '  it("covers the linked acceptance criterion", async () => {',
        "    expect(true).toBe(true);",
        "  });",
        "});",
        "",
      ].join("\n"),
      "utf8",
    );

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
      name: "Validate and project product model",
      description: "Enables users to validate product events and regenerate the current-state product model.",
      actorId: "capability_modeller",
      actorType: "agent",
      occurredAt: "2026-05-31T09:05:00.000Z",
      eventsRoot,
      modelRoot,
    });

    await createFeature({
      capabilityId: "CAP-001",
      name: "Create tests for acceptance criteria",
      description: "Creates tests for acceptance criteria by annotating source and recording test locations.",
      requirementDescription: "The system shall annotate a test and create a test artifact linked to an acceptance criterion with file path and test name.",
      acceptanceCriterionTexts: [
        "Given an acceptance criterion and test locator, when the helper is run, then the test is annotated and a test artifact is recorded.",
      ],
      actorId: "feature_specifier",
      actorType: "agent",
      occurredAt: "2026-05-31T09:10:00.000Z",
      eventsRoot,
      modelRoot,
    });

    const result = await createTest({
      acceptanceCriterionIds: ["AC-001"],
      filePath: testFile,
      testName: "covers the linked acceptance criterion",
      actorId: "test_agent",
      actorType: "agent",
      occurredAt: "2026-05-31T09:15:00.000Z",
      eventsRoot,
      modelRoot,
    });

    expect(result.testIds).toEqual(["TEST-001"]);
    expect(result.eventIds).toEqual(["EVT-20260531-0006"]);

    const updatedTestFile = await readFile(testFile, "utf8");
    expect(updatedTestFile).toContain('// AC: AC-001\n  it("covers the linked acceptance criterion"');

    const validation = await validateEvents(eventsRoot);
    expect(validation.errors).toEqual([]);
    expect(validation.events).toHaveLength(6);
    expect(validation.events.at(-1)?.event.type).toBe("TestCreated");

    const traceabilityMatrix = await readFile(path.join(modelRoot, "indexes", "traceability-matrix.yaml"), "utf8");
    expect(traceabilityMatrix).toContain("acceptance_criterion_id: AC-001");
    expect(traceabilityMatrix).toContain("- TEST-001");

    const testYaml = await readFile(path.join(modelRoot, "tests", "TEST-001.yaml"), "utf8");
    expect(testYaml).toContain("acceptance_criterion_id: AC-001");
    expect(testYaml).toContain("sample.test.ts");
    expect(testYaml).not.toContain("line_number:");
    expect(testYaml).toContain("test_name: covers the linked acceptance criterion");
  });
});

