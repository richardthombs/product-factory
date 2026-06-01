import { readFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { ZodError } from "zod";
import { CAPABILITY_STATUSES, FEATURE_STATUSES } from "../domain/status.js";
import { eventSchema, type ProductEvent } from "../schemas/events.js";
import { listFilesRecursive } from "../util/fs.js";
import type { LoadedEvent, ValidationError, ValidationResult } from "./types.js";

export const DEFAULT_EVENTS_ROOT = path.resolve(process.cwd(), "product-events");

export async function validateEvents(eventsRoot = DEFAULT_EVENTS_ROOT): Promise<ValidationResult> {
  const files = await listEventFiles(eventsRoot);
  const parsed: LoadedEvent[] = [];
  const errors: ValidationError[] = [];

  for (const filePath of files) {
    const fileErrors = await parseEventFile(filePath);
    if ("errors" in fileErrors) {
      errors.push(...fileErrors.errors);
      continue;
    }

    parsed.push(fileErrors);
  }

  const validated = await validateLoadedEvents(parsed, eventsRoot);
  return {
    events: validated.events,
    errors: [...errors, ...validated.errors],
  };
}

export async function validateLoadedEvents(events: LoadedEvent[], eventsRoot: string): Promise<ValidationResult> {
  const sortedEvents = [...events].sort(compareLoadedEvents);
  const errors = await validateRepositoryRules(sortedEvents, eventsRoot);

  return {
    events: sortedEvents,
    errors,
  };
}

async function listEventFiles(eventsRoot: string): Promise<string[]> {
  try {
    const files = await listFilesRecursive(eventsRoot);
    return files.filter((file) => file.endsWith(".yaml") || file.endsWith(".yml"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not read event directory '${eventsRoot}': ${message}`);
  }
}

async function parseEventFile(filePath: string): Promise<LoadedEvent | { errors: ValidationError[] }> {
  try {
    const content = await readFile(filePath, "utf8");
    const raw = YAML.parse(content);
    const event = eventSchema.parse(raw);
    return { path: filePath, event };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        errors: error.issues.map((issue) => ({
          path: filePath,
          message: `${issue.path.join(".") || "root"}: ${issue.message}`,
        })),
      };
    }

    const message = error instanceof Error ? error.message : String(error);
    return {
      errors: [{
        path: filePath,
        message,
      }],
    };
  }
}

export function compareLoadedEvents(a: LoadedEvent, b: LoadedEvent): number {
  const byTimestamp = a.event.occurred_at.localeCompare(b.event.occurred_at);
  if (byTimestamp !== 0) {
    return byTimestamp;
  }

  return a.event.id.localeCompare(b.event.id);
}

async function validateRepositoryRules(events: LoadedEvent[], eventsRoot: string): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];
  const eventIds = new Map<string, string>();
  const capabilityIds = new Map<string, string>();
  const featureIds = new Map<string, string>();
  const currentFeatureCapabilities = new Map<string, string>();
  const requirementIds = new Map<string, string>();
  const acceptanceCriterionIds = new Map<string, string>();
  const testIds = new Map<string, string>();
  const testSignatures = new Set<string>();
  let productCreated: LoadedEvent | null = null;
  let productCount = 0;

  for (const loaded of events) {
    const duplicateEventPath = eventIds.get(loaded.event.id);
    if (duplicateEventPath) {
      errors.push({
        path: loaded.path,
        message: `Duplicate event id '${loaded.event.id}' also found in ${duplicateEventPath}`,
      });
    } else {
      eventIds.set(loaded.event.id, loaded.path);
    }

    switch (loaded.event.type) {
      case "ProductCreated": {
        productCount += 1;
        if (!productCreated) {
          productCreated = loaded;
        }
        if (productCount > 1) {
          errors.push({
            path: loaded.path,
            message: "Exactly one ProductCreated event is allowed",
          });
        }
        break;
      }
      case "CapabilityAdded": {
        if (!productCreated) {
          errors.push({
            path: loaded.path,
            message: "CapabilityAdded requires ProductCreated to exist first",
          });
        }
        recordUniqueEntity(capabilityIds, loaded.event.payload.capability_id, loaded.path, "capability", errors);
        break;
      }
      case "FeatureAdded": {
        if (!productCreated) {
          errors.push({
            path: loaded.path,
            message: "FeatureAdded requires ProductCreated to exist first",
          });
        }
        recordUniqueEntity(featureIds, loaded.event.payload.feature_id, loaded.path, "feature", errors);
        if (!capabilityIds.has(loaded.event.payload.capability_id)) {
          errors.push({
            path: loaded.path,
            message: `FeatureAdded references missing capability '${loaded.event.payload.capability_id}'`,
          });
        } else {
          currentFeatureCapabilities.set(loaded.event.payload.feature_id, loaded.event.payload.capability_id);
        }
        break;
      }
      case "RequirementAdded": {
        if (!productCreated) {
          errors.push({
            path: loaded.path,
            message: "RequirementAdded requires ProductCreated to exist first",
          });
        }
        recordUniqueEntity(requirementIds, loaded.event.payload.requirement_id, loaded.path, "requirement", errors);
        if (!featureIds.has(loaded.event.payload.feature_id)) {
          errors.push({
            path: loaded.path,
            message: `RequirementAdded references missing feature '${loaded.event.payload.feature_id}'`,
          });
        }
        break;
      }
      case "AcceptanceCriterionAdded": {
        if (!productCreated) {
          errors.push({
            path: loaded.path,
            message: "AcceptanceCriterionAdded requires ProductCreated to exist first",
          });
        }
        recordUniqueEntity(
          acceptanceCriterionIds,
          loaded.event.payload.acceptance_criterion_id,
          loaded.path,
          "acceptance criterion",
          errors,
        );
        if (!requirementIds.has(loaded.event.payload.requirement_id)) {
          errors.push({
            path: loaded.path,
            message: `AcceptanceCriterionAdded references missing requirement '${loaded.event.payload.requirement_id}'`,
          });
        }
        break;
      }
      case "FeatureChanged": {
        if (!productCreated) {
          errors.push({
            path: loaded.path,
            message: "FeatureChanged requires ProductCreated to exist first",
          });
        }
        if (!featureIds.has(loaded.event.payload.feature_id)) {
          errors.push({
            path: loaded.path,
            message: `FeatureChanged references missing feature '${loaded.event.payload.feature_id}'`,
          });
        }
        break;
      }
      case "RequirementChanged": {
        if (!productCreated) {
          errors.push({
            path: loaded.path,
            message: "RequirementChanged requires ProductCreated to exist first",
          });
        }
        if (!requirementIds.has(loaded.event.payload.requirement_id)) {
          errors.push({
            path: loaded.path,
            message: `RequirementChanged references missing requirement '${loaded.event.payload.requirement_id}'`,
          });
        }
        break;
      }
      case "AcceptanceCriterionChanged": {
        if (!productCreated) {
          errors.push({
            path: loaded.path,
            message: "AcceptanceCriterionChanged requires ProductCreated to exist first",
          });
        }
        if (!acceptanceCriterionIds.has(loaded.event.payload.acceptance_criterion_id)) {
          errors.push({
            path: loaded.path,
            message: `AcceptanceCriterionChanged references missing acceptance criterion '${loaded.event.payload.acceptance_criterion_id}'`,
          });
        }
        break;
      }
      case "FeatureMovedToCapability": {
        if (!productCreated) {
          errors.push({
            path: loaded.path,
            message: "FeatureMovedToCapability requires ProductCreated to exist first",
          });
        }
        if (!featureIds.has(loaded.event.payload.feature_id)) {
          errors.push({
            path: loaded.path,
            message: `FeatureMovedToCapability references missing feature '${loaded.event.payload.feature_id}'`,
          });
        }
        if (!capabilityIds.has(loaded.event.payload.capability_id)) {
          errors.push({
            path: loaded.path,
            message: `FeatureMovedToCapability references missing capability '${loaded.event.payload.capability_id}'`,
          });
        }
        const currentCapabilityId = currentFeatureCapabilities.get(loaded.event.payload.feature_id);
        if (currentCapabilityId === loaded.event.payload.capability_id) {
          errors.push({
            path: loaded.path,
            message: `FeatureMovedToCapability would not change the capability for feature '${loaded.event.payload.feature_id}'`,
          });
        } else if (currentCapabilityId && capabilityIds.has(loaded.event.payload.capability_id)) {
          currentFeatureCapabilities.set(loaded.event.payload.feature_id, loaded.event.payload.capability_id);
        }
        break;
      }
      case "FeatureDeprecated": {
        if (!productCreated) {
          errors.push({
            path: loaded.path,
            message: "FeatureDeprecated requires ProductCreated to exist first",
          });
        }
        if (!featureIds.has(loaded.event.payload.feature_id)) {
          errors.push({
            path: loaded.path,
            message: `FeatureDeprecated references missing feature '${loaded.event.payload.feature_id}'`,
          });
        }
        break;
      }
      case "FeatureStatusChanged": {
        if (!productCreated) {
          errors.push({
            path: loaded.path,
            message: "FeatureStatusChanged requires ProductCreated to exist first",
          });
        }
        if (!featureIds.has(loaded.event.payload.feature_id)) {
          errors.push({
            path: loaded.path,
            message: `FeatureStatusChanged references missing feature '${loaded.event.payload.feature_id}'`,
          });
        }
        if (!FEATURE_STATUSES.includes(loaded.event.payload.status)) {
          errors.push({
            path: loaded.path,
            message: `FeatureStatusChanged uses invalid status '${loaded.event.payload.status}'`,
          });
        }
        break;
      }
      case "CapabilityStatusChanged": {
        if (!productCreated) {
          errors.push({
            path: loaded.path,
            message: "CapabilityStatusChanged requires ProductCreated to exist first",
          });
        }
        if (!capabilityIds.has(loaded.event.payload.capability_id)) {
          errors.push({
            path: loaded.path,
            message: `CapabilityStatusChanged references missing capability '${loaded.event.payload.capability_id}'`,
          });
        }
        if (!CAPABILITY_STATUSES.includes(loaded.event.payload.status)) {
          errors.push({
            path: loaded.path,
            message: `CapabilityStatusChanged uses invalid status '${loaded.event.payload.status}'`,
          });
        }
        break;
      }
      case "TestCreated": {
        if (!productCreated) {
          errors.push({
            path: loaded.path,
            message: "TestCreated requires ProductCreated to exist first",
          });
        }
        recordUniqueEntity(testIds, loaded.event.payload.test_id, loaded.path, "test", errors);
        if (!acceptanceCriterionIds.has(loaded.event.payload.acceptance_criterion_id)) {
          errors.push({
            path: loaded.path,
            message: `TestCreated references missing acceptance criterion '${loaded.event.payload.acceptance_criterion_id}'`,
          });
        }

        const signature = [
          loaded.event.payload.acceptance_criterion_id,
          loaded.event.payload.file_path,
          loaded.event.payload.test_name,
        ].join("|");
        if (testSignatures.has(signature)) {
          errors.push({
            path: loaded.path,
            message: `Duplicate test signature '${signature}'`,
          });
        } else {
          testSignatures.add(signature);
        }

        errors.push(...await validateTestSource(loaded));
        break;
      }
      default: {
        assertNever(loaded.event);
      }
    }
  }

  if (!productCreated) {
    errors.push({
      path: eventsRoot,
      message: "A ProductCreated event is required",
    });
  }

  return errors;
}

async function validateTestSource(loaded: LoadedEvent): Promise<ValidationError[]> {
  if (loaded.event.type !== "TestCreated") {
    return [];
  }

  const errors: ValidationError[] = [];
  const filePath = path.resolve(process.cwd(), loaded.event.payload.file_path);

  try {
    const content = await readFile(filePath, "utf8");
    const lines = content.split(/\r?\n/);
    const match = lines
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => line.includes(loaded.event.payload.test_name));

    if (match.length === 0) {
      errors.push({
        path: loaded.path,
        message: `Could not find a test line containing '${loaded.event.payload.test_name}' in '${loaded.event.payload.file_path}'`,
      });
      return errors;
    }

    if (match.length > 1) {
      errors.push({
        path: loaded.path,
        message: `Found multiple test lines containing '${loaded.event.payload.test_name}' in '${loaded.event.payload.file_path}'`,
      });
      return errors;
    }

    const testLineIndex = match[0].index;
    const annotationLine = lines[testLineIndex - 1] ?? "";
    const acceptanceCriterionId = loaded.event.payload.acceptance_criterion_id;
    if (!annotationLine.includes(`AC: ${acceptanceCriterionId}`)
      && !annotationLine.includes(`, ${acceptanceCriterionId}`)
      && !annotationLine.includes(`${acceptanceCriterionId},`)) {
      errors.push({
        path: loaded.path,
        message: `Expected AC annotation immediately above test '${loaded.event.payload.test_name}' in '${loaded.event.payload.file_path}'`,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push({
      path: loaded.path,
      message: `Could not validate linked test source '${loaded.event.payload.file_path}': ${message}`,
    });
  }

  return errors;
}

function recordUniqueEntity(
  seen: Map<string, string>,
  id: string,
  filePath: string,
  label: string,
  errors: ValidationError[],
): void {
  const duplicatePath = seen.get(id);
  if (duplicatePath) {
    errors.push({
      path: filePath,
      message: `Duplicate ${label} id '${id}' also found in ${duplicatePath}`,
    });
    return;
  }

  seen.set(id, filePath);
}

function assertNever(value: never): never {
  throw new Error(`Unexpected event type: ${JSON.stringify(value)}`);
}

export function summarizeEvents(events: LoadedEvent[]): Record<ProductEvent["type"], number> {
  return events.reduce<Record<ProductEvent["type"], number>>(
    (summary, { event }) => {
      summary[event.type] += 1;
      return summary;
    },
    {
      ProductCreated: 0,
      CapabilityAdded: 0,
      FeatureAdded: 0,
      RequirementAdded: 0,
      AcceptanceCriterionAdded: 0,
      FeatureChanged: 0,
      RequirementChanged: 0,
      AcceptanceCriterionChanged: 0,
      FeatureMovedToCapability: 0,
      FeatureDeprecated: 0,
      FeatureStatusChanged: 0,
      CapabilityStatusChanged: 0,
      TestCreated: 0,
    },
  );
}
