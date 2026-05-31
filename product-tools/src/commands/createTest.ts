import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { replayEvents } from "../projection/replay.js";
import { DEFAULT_MODEL_ROOT, projectModel } from "../projection/projectModel.js";
import { nextEntityId, nextEventId } from "../util/ids.js";
import { slugify } from "../util/slug.js";
import { DEFAULT_EVENTS_ROOT, validateEvents } from "../validation/validateEvents.js";
import type { ProductEvent } from "../schemas/events.js";
import type { LoadedEvent } from "../validation/types.js";

export type CreateTestOptions = {
  acceptanceCriterionIds: string[];
  filePath: string;
  testName: string;
  actorId?: string;
  actorType?: "agent" | "human" | "system";
  changeProposalId?: string;
  conversationId?: string;
  eventsRoot?: string;
  modelRoot?: string;
  occurredAt?: string;
};

export type CreateTestResult = {
  testIds: string[];
  acceptanceCriterionIds: string[];
  filePath: string;
  lineNumber: number;
  testName: string;
  eventIds: string[];
  files: string[];
};

export async function createTest(options: CreateTestOptions): Promise<CreateTestResult> {
  const eventsRoot = options.eventsRoot ?? DEFAULT_EVENTS_ROOT;
  const modelRoot = options.modelRoot ?? DEFAULT_MODEL_ROOT;
  const actorType = options.actorType ?? "agent";
  const actorId = options.actorId ?? "test_agent";
  const validation = await validateEvents(eventsRoot);

  if (validation.errors.length > 0) {
    const details = validation.errors.map((error) => `- ${error.path}: ${error.message}`).join("\n");
    throw new Error(`Cannot create test because the current event stream is invalid:\n${details}`);
  }

  if (options.acceptanceCriterionIds.length === 0) {
    throw new Error("At least one acceptance criterion id is required");
  }

  const uniqueAcceptanceCriterionIds = [...new Set(options.acceptanceCriterionIds)].sort();
  const state = replayEvents(validation.events);
  for (const acceptanceCriterionId of uniqueAcceptanceCriterionIds) {
    if (!state.acceptanceCriteria.has(acceptanceCriterionId)) {
      throw new Error(`Acceptance criterion '${acceptanceCriterionId}' does not exist`);
    }
  }

  const absoluteFilePath = path.resolve(process.cwd(), options.filePath);
  const relativeFilePath = path.relative(process.cwd(), absoluteFilePath).replaceAll("\\", "/");
  const originalContent = await readFile(absoluteFilePath, "utf8");
  const { content: annotatedContent, lineNumber } = annotateTestSource(
    originalContent,
    uniqueAcceptanceCriterionIds,
    options.testName,
  );

  const existingTestSignatures = validation.events
    .filter((loaded): loaded is LoadedEvent & { event: Extract<ProductEvent, { type: "TestCreated" }> } => loaded.event.type === "TestCreated")
    .map(({ event }) => `${event.payload.acceptance_criterion_id}|${event.payload.file_path}|${event.payload.line_number}|${event.payload.test_name}`);

  const duplicateKeys = uniqueAcceptanceCriterionIds
    .map((acceptanceCriterionId) => `${acceptanceCriterionId}|${relativeFilePath}|${lineNumber}|${options.testName}`)
    .filter((key) => existingTestSignatures.includes(key));
  if (duplicateKeys.length > 0) {
    throw new Error(`Test already exists for ${duplicateKeys.join(", ")}`);
  }

  const existingTestIds = validation.events
    .filter((loaded): loaded is LoadedEvent & { event: Extract<ProductEvent, { type: "TestCreated" }> } => loaded.event.type === "TestCreated")
    .map(({ event }) => event.payload.test_id);

  const testIds: string[] = [];
  let reservedTestIds = [...existingTestIds];
  for (let index = 0; index < uniqueAcceptanceCriterionIds.length; index += 1) {
    const nextTestId = nextEntityId("TEST", reservedTestIds);
    testIds.push(nextTestId);
    reservedTestIds = [...reservedTestIds, nextTestId];
  }

  const baseOccurredAt = options.occurredAt ?? new Date().toISOString();
  const occurredAts = buildOccurredAtSequence(baseOccurredAt, uniqueAcceptanceCriterionIds.length);
  const source = buildSource(options.changeProposalId, options.conversationId);
  const reservedEventIds: string[] = [];

  const events: ProductEvent[] = uniqueAcceptanceCriterionIds.map((acceptanceCriterionId, index) => ({
    id: reserveEventId(validation.events, occurredAts[index], reservedEventIds),
    type: "TestCreated",
    occurred_at: occurredAts[index],
    actor: { type: actorType, id: actorId },
    ...(source ? { source } : {}),
    payload: {
      test_id: testIds[index],
      acceptance_criterion_id: acceptanceCriterionId,
      file_path: relativeFilePath,
      line_number: lineNumber,
      test_name: options.testName,
    },
  }));

  const files = buildEventFilePaths(eventsRoot, events);
  const writtenFiles: string[] = [];

  try {
    await writeFile(absoluteFilePath, annotatedContent, "utf8");

    for (let index = 0; index < events.length; index += 1) {
      const filePath = files[index];
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, YAML.stringify(events[index]), { encoding: "utf8", flag: "wx" });
      writtenFiles.push(filePath);
    }

    await projectModel(eventsRoot, modelRoot);

    return {
      testIds,
      acceptanceCriterionIds: uniqueAcceptanceCriterionIds,
      filePath: relativeFilePath,
      lineNumber,
      testName: options.testName,
      eventIds: events.map((event) => event.id),
      files,
    };
  } catch (error) {
    await writeFile(absoluteFilePath, originalContent, "utf8");
    await Promise.all(writtenFiles.map((filePath) => rm(filePath, { force: true })));
    await projectModel(eventsRoot, modelRoot).catch(() => undefined);
    throw error;
  }
}

function annotateTestSource(content: string, acceptanceCriterionIds: string[], testName: string): { content: string; lineNumber: number } {
  const lines = content.split(/\r?\n/);
  const matchingIndexes = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => line.includes(testName));

  if (matchingIndexes.length === 0) {
    throw new Error(`Could not find a test line containing '${testName}'`);
  }
  if (matchingIndexes.length > 1) {
    throw new Error(`Found multiple test lines containing '${testName}'. Please make the name more specific.`);
  }

  const testLineIndex = matchingIndexes[0].index;
  const annotation = `// AC: ${acceptanceCriterionIds.join(", ")}`;
  const previousLine = lines[testLineIndex - 1] ?? "";

  if (previousLine.trim().startsWith("// AC:")) {
    const existingIds = previousLine
      .replace(/^\s*\/\/\s*AC:\s*/, "")
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    const mergedIds = [...new Set([...existingIds, ...acceptanceCriterionIds])].sort();
    lines[testLineIndex - 1] = `// AC: ${mergedIds.join(", ")}`;
    return {
      content: `${lines.join("\n")}\n`,
      lineNumber: testLineIndex + 1,
    };
  }

  lines.splice(testLineIndex, 0, annotation);
  return {
    content: `${lines.join("\n")}\n`,
    lineNumber: testLineIndex + 2,
  };
}

function buildOccurredAtSequence(baseOccurredAt: string, count: number): string[] {
  const base = new Date(baseOccurredAt);
  if (Number.isNaN(base.getTime())) {
    throw new Error(`Invalid occurred_at value '${baseOccurredAt}'`);
  }

  return Array.from({ length: count }, (_, index) => new Date(base.getTime() + index * 1000).toISOString());
}

function reserveEventId(existingEvents: LoadedEvent[], occurredAt: string, reservedEventIds: string[]): string {
  const nextId = nextEventId(existingEvents, occurredAt, reservedEventIds);
  reservedEventIds.push(nextId);
  return nextId;
}

function buildSource(changeProposalId?: string, conversationId?: string) {
  const source = {
    ...(changeProposalId ? { change_proposal_id: changeProposalId } : {}),
    ...(conversationId ? { conversation_id: conversationId } : {}),
  };

  return Object.keys(source).length > 0 ? source : undefined;
}

function buildEventFilePaths(eventsRoot: string, events: ProductEvent[]): string[] {
  return events.map((event) => {
    const [year, month, day] = event.occurred_at.slice(0, 10).split("-");
    const typeSlug = slugify(event.type.replace(/([a-z0-9])([A-Z])/g, "$1-$2"));
    return path.join(eventsRoot, year, month, day, `${event.id}-${typeSlug}.yaml`);
  });
}
