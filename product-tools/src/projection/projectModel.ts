import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_EVENTS_ROOT, validateEvents } from "../validation/validateEvents.js";
import type { LoadedEvent } from "../validation/types.js";
import { prepareModelOutput } from "../util/generatedOutput.js";
import { slugify } from "../util/slug.js";
import { toGeneratedMarkdown } from "../util/markdown.js";
import { toGeneratedYaml } from "../util/yaml.js";
import { replayEvents } from "./replay.js";
import { renderProjectDocument } from "./projectDocument.js";
import type {
  AcceptanceCriterionState,
  CapabilityState,
  FeatureState,
  ProductModelState,
  ProjectionSummary,
  RequirementState,
  TestState,
} from "./types.js";

export const DEFAULT_MODEL_ROOT = path.resolve(process.cwd(), "product-model");

export async function projectModel(
  eventsRoot = DEFAULT_EVENTS_ROOT,
  modelRoot = DEFAULT_MODEL_ROOT,
): Promise<ProjectionSummary> {
  const validation = await validateEvents(eventsRoot);
  if (validation.errors.length > 0) {
    const details = validation.errors.map((error) => `- ${error.path}: ${error.message}`).join("\n");
    throw new Error(`Event validation failed:\n${details}`);
  }

  return projectValidatedModel(validation.events, modelRoot);
}

export async function projectValidatedModel(events: LoadedEvent[], modelRoot = DEFAULT_MODEL_ROOT): Promise<ProjectionSummary> {
  const state = replayEvents(events);
  const summary = buildProjectionSummary(events, state);

  await prepareModelOutput(modelRoot);
  await mkdir(modelRoot, { recursive: true });

  await Promise.all([
    writeProductFile(modelRoot, state, summary),
    writeProjectDocumentFile(modelRoot, state, summary),
    writeCapabilityFiles(modelRoot, state),
    writeFeatureFiles(modelRoot, state),
    writeRequirementFiles(modelRoot, state),
    writeAcceptanceCriterionFiles(modelRoot, state),
    writeTestFiles(modelRoot, state),
    writeIndexes(modelRoot, state, summary),
  ]);

  return summary;
}

function buildProjectionSummary(events: LoadedEvent[], state: ProductModelState): ProjectionSummary {
  const lastEvent = events.at(-1);
  if (!lastEvent) {
    throw new Error("Cannot build projection summary for an empty event stream");
  }

  return {
    eventCount: events.length,
    capabilityCount: state.capabilities.size,
    featureCount: state.features.size,
    requirementCount: state.requirements.size,
    acceptanceCriterionCount: state.acceptanceCriteria.size,
    testCount: state.tests.size,
    lastEventId: lastEvent.event.id,
    lastOccurredAt: lastEvent.event.occurred_at,
  };
}

async function writeProductFile(modelRoot: string, state: ProductModelState, summary: ProjectionSummary): Promise<void> {
  const capabilityIds = sortById([...state.capabilities.values()]).map((capability) => capability.id);

  const productDocument = {
    id: state.product.id,
    name: state.product.name,
    description: state.product.description,
    capability_ids: capabilityIds,
    counts: {
      capabilities: summary.capabilityCount,
      features: summary.featureCount,
      requirements: summary.requirementCount,
      acceptance_criteria: summary.acceptanceCriterionCount,
      tests: summary.testCount,
      events: summary.eventCount,
    },
    projection: {
      last_event_id: summary.lastEventId,
      last_occurred_at: summary.lastOccurredAt,
    },
  };

  await writeGeneratedYaml(path.join(modelRoot, "product.yaml"), productDocument);
}

async function writeProjectDocumentFile(
  modelRoot: string,
  state: ProductModelState,
  summary: ProjectionSummary,
): Promise<void> {
  const document = renderProjectDocument(state, summary);
  await writeGeneratedMarkdown(path.join(modelRoot, "project.md"), document);
}

async function writeCapabilityFiles(modelRoot: string, state: ProductModelState): Promise<void> {
  const capabilities = sortById([...state.capabilities.values()]);

  await Promise.all(
    capabilities.map(async (capability) => {
      const document = {
        id: capability.id,
        name: capability.name,
        description: capability.description,
        feature_ids: [...capability.featureIds].sort(),
      };

      await writeGeneratedYaml(
        path.join(modelRoot, "capabilities", `${capability.id}-${slugify(capability.name)}.yaml`),
        document,
      );
    }),
  );
}

async function writeFeatureFiles(modelRoot: string, state: ProductModelState): Promise<void> {
  const features = sortById([...state.features.values()]);

  await Promise.all(
    features.map(async (feature) => {
      const document = {
        id: feature.id,
        capability_id: feature.capabilityId,
        name: feature.name,
        description: feature.description,
        requirement_ids: [...feature.requirementIds].sort(),
      };

      await writeGeneratedYaml(
        path.join(modelRoot, "features", `${feature.id}-${slugify(feature.name)}.yaml`),
        document,
      );
    }),
  );
}

async function writeRequirementFiles(modelRoot: string, state: ProductModelState): Promise<void> {
  const requirements = sortById([...state.requirements.values()]);

  await Promise.all(
    requirements.map(async (requirement) => {
      const document = {
        id: requirement.id,
        feature_id: requirement.featureId,
        description: requirement.description,
        acceptance_criterion_ids: [...requirement.acceptanceCriterionIds].sort(),
      };

      await writeGeneratedYaml(path.join(modelRoot, "requirements", `${requirement.id}.yaml`), document);
    }),
  );
}

async function writeAcceptanceCriterionFiles(modelRoot: string, state: ProductModelState): Promise<void> {
  const acceptanceCriteria = sortById([...state.acceptanceCriteria.values()]);

  await Promise.all(
    acceptanceCriteria.map(async (acceptanceCriterion) => {
      const document = {
        id: acceptanceCriterion.id,
        requirement_id: acceptanceCriterion.requirementId,
        text: acceptanceCriterion.text,
        tests: buildTestIdsForAcceptanceCriterion(state, acceptanceCriterion.id),
      };

      await writeGeneratedYaml(
        path.join(modelRoot, "acceptance-criteria", `${acceptanceCriterion.id}.yaml`),
        document,
      );
    }),
  );
}

async function writeTestFiles(modelRoot: string, state: ProductModelState): Promise<void> {
  const tests = sortById([...state.tests.values()]);

  await Promise.all(
    tests.map(async (test) => {
      const document = {
        id: test.id,
        acceptance_criterion_id: test.acceptanceCriterionId,
        file_path: test.filePath,
        line_number: test.lineNumber,
        test_name: test.testName,
      };

      await writeGeneratedYaml(path.join(modelRoot, "tests", `${test.id}.yaml`), document);
    }),
  );
}

async function writeIndexes(modelRoot: string, state: ProductModelState, summary: ProjectionSummary): Promise<void> {
  const capabilities = sortById([...state.capabilities.values()]);
  const capabilityMap = {
    product_id: state.product.id,
    capabilities: capabilities.map((capability) => ({
      capability_id: capability.id,
      capability_name: capability.name,
      feature_ids: [...capability.featureIds].sort(),
    })),
  };

  const traceabilityMatrix = {
    product_id: state.product.id,
    projected_from: {
      event_count: summary.eventCount,
      test_count: summary.testCount,
      last_event_id: summary.lastEventId,
      last_occurred_at: summary.lastOccurredAt,
    },
    capabilities: capabilities.map((capability) => ({
      capability_id: capability.id,
      capability_name: capability.name,
      features: [...capability.featureIds]
        .sort()
        .map((featureId) => buildFeatureTraceability(state, featureId)),
    })),
  };

  const testCatalog = {
    product_id: state.product.id,
    test_count: summary.testCount,
    tests: sortById([...state.tests.values()]).map((test) => ({
      id: test.id,
      acceptance_criterion_id: test.acceptanceCriterionId,
      file_path: test.filePath,
      line_number: test.lineNumber,
      test_name: test.testName,
    })),
  };

  await Promise.all([
    writeGeneratedYaml(path.join(modelRoot, "indexes", "capability-map.yaml"), capabilityMap),
    writeGeneratedYaml(path.join(modelRoot, "indexes", "traceability-matrix.yaml"), traceabilityMatrix),
    writeGeneratedYaml(path.join(modelRoot, "indexes", "tests.yaml"), testCatalog),
  ]);
}

function buildFeatureTraceability(state: ProductModelState, featureId: string) {
  const feature = state.features.get(featureId);
  if (!feature) {
    throw new Error(`Missing feature '${featureId}' while building traceability index`);
  }

  return {
    feature_id: feature.id,
    feature_name: feature.name,
    requirements: [...feature.requirementIds].sort().map((requirementId) => buildRequirementTraceability(state, requirementId)),
  };
}

function buildRequirementTraceability(state: ProductModelState, requirementId: string) {
  const requirement = state.requirements.get(requirementId);
  if (!requirement) {
    throw new Error(`Missing requirement '${requirementId}' while building traceability index`);
  }

  return {
    requirement_id: requirement.id,
    description: requirement.description,
    acceptance_criteria: [...requirement.acceptanceCriterionIds]
      .sort()
      .map((acceptanceCriterionId) => buildAcceptanceCriterionTraceability(state, acceptanceCriterionId)),
  };
}

function buildAcceptanceCriterionTraceability(state: ProductModelState, acceptanceCriterionId: string) {
  const acceptanceCriterion = state.acceptanceCriteria.get(acceptanceCriterionId);
  if (!acceptanceCriterion) {
    throw new Error(
      `Missing acceptance criterion '${acceptanceCriterionId}' while building traceability index`,
    );
  }

  return {
    acceptance_criterion_id: acceptanceCriterion.id,
    text: acceptanceCriterion.text,
    tests: buildTestIdsForAcceptanceCriterion(state, acceptanceCriterion.id),
  };
}

function buildTestIdsForAcceptanceCriterion(state: ProductModelState, acceptanceCriterionId: string): string[] {
  return sortById(
    [...state.tests.values()].filter((test) => test.acceptanceCriterionId === acceptanceCriterionId),
  ).map((test) => test.id);
}

async function writeGeneratedYaml(filePath: string, document: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, toGeneratedYaml(document), "utf8");
}

async function writeGeneratedMarkdown(filePath: string, content: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, toGeneratedMarkdown(content), "utf8");
}

function sortById<T extends { id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.id.localeCompare(b.id));
}
