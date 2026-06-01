import { readFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { ZodError } from "zod";
import { CAPABILITY_STATUSES, FEATURE_STATUSES } from "../domain/status.js";
import { eventSchema, type EntityType, type ProductEvent } from "../schemas/events.js";
import { listFilesRecursive } from "../util/fs.js";
import type { LoadedEvent, ValidationError, ValidationResult } from "./types.js";

export const DEFAULT_EVENTS_ROOT = path.resolve(process.cwd(), "product-events");

type EntityIdMaps = {
  product: Map<string, string>;
  capability: Map<string, string>;
  feature: Map<string, string>;
  requirement: Map<string, string>;
  acceptance_criterion: Map<string, string>;
  test: Map<string, string>;
};

type EntityEventHistory = {
  [K in EntityType]: Map<string, string[]>;
};

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
  const entityIds: EntityIdMaps = {
    product: new Map<string, string>(),
    capability: new Map<string, string>(),
    feature: new Map<string, string>(),
    requirement: new Map<string, string>(),
    acceptance_criterion: new Map<string, string>(),
    test: new Map<string, string>(),
  };
  const eventHistory = createEntityEventHistory();
  const currentFeatureCapabilities = new Map<string, string>();
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

    validateConcurrencyPreconditions(loaded, entityIds, eventHistory, errors);

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
        recordUniqueEntity(entityIds.product, loaded.event.payload.product_id, loaded.path, "product", errors);
        recordEventImpact(eventHistory, "product", loaded.event.payload.product_id, loaded.event.id);
        break;
      }
      case "CapabilityAdded": {
        if (!productCreated) {
          errors.push({
            path: loaded.path,
            message: "CapabilityAdded requires ProductCreated to exist first",
          });
        }
        recordUniqueEntity(entityIds.capability, loaded.event.payload.capability_id, loaded.path, "capability", errors);
        recordEventImpact(eventHistory, "capability", loaded.event.payload.capability_id, loaded.event.id);
        break;
      }
      case "FeatureAdded": {
        if (!productCreated) {
          errors.push({
            path: loaded.path,
            message: "FeatureAdded requires ProductCreated to exist first",
          });
        }
        recordUniqueEntity(entityIds.feature, loaded.event.payload.feature_id, loaded.path, "feature", errors);
        if (!entityIds.capability.has(loaded.event.payload.capability_id)) {
          errors.push({
            path: loaded.path,
            message: `FeatureAdded references missing capability '${loaded.event.payload.capability_id}'`,
          });
        } else {
          currentFeatureCapabilities.set(loaded.event.payload.feature_id, loaded.event.payload.capability_id);
        }
        recordEventImpact(eventHistory, "feature", loaded.event.payload.feature_id, loaded.event.id);
        if (entityIds.capability.has(loaded.event.payload.capability_id)) {
          recordEventImpact(eventHistory, "capability", loaded.event.payload.capability_id, loaded.event.id);
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
        recordUniqueEntity(entityIds.requirement, loaded.event.payload.requirement_id, loaded.path, "requirement", errors);
        if (!entityIds.feature.has(loaded.event.payload.feature_id)) {
          errors.push({
            path: loaded.path,
            message: `RequirementAdded references missing feature '${loaded.event.payload.feature_id}'`,
          });
        }
        recordEventImpact(eventHistory, "requirement", loaded.event.payload.requirement_id, loaded.event.id);
        if (entityIds.feature.has(loaded.event.payload.feature_id)) {
          recordEventImpact(eventHistory, "feature", loaded.event.payload.feature_id, loaded.event.id);
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
          entityIds.acceptance_criterion,
          loaded.event.payload.acceptance_criterion_id,
          loaded.path,
          "acceptance criterion",
          errors,
        );
        if (!entityIds.requirement.has(loaded.event.payload.requirement_id)) {
          errors.push({
            path: loaded.path,
            message: `AcceptanceCriterionAdded references missing requirement '${loaded.event.payload.requirement_id}'`,
          });
        }
        recordEventImpact(eventHistory, "acceptance_criterion", loaded.event.payload.acceptance_criterion_id, loaded.event.id);
        if (entityIds.requirement.has(loaded.event.payload.requirement_id)) {
          recordEventImpact(eventHistory, "requirement", loaded.event.payload.requirement_id, loaded.event.id);
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
        if (!entityIds.feature.has(loaded.event.payload.feature_id)) {
          errors.push({
            path: loaded.path,
            message: `FeatureChanged references missing feature '${loaded.event.payload.feature_id}'`,
          });
        } else {
          recordEventImpact(eventHistory, "feature", loaded.event.payload.feature_id, loaded.event.id);
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
        if (!entityIds.requirement.has(loaded.event.payload.requirement_id)) {
          errors.push({
            path: loaded.path,
            message: `RequirementChanged references missing requirement '${loaded.event.payload.requirement_id}'`,
          });
        } else {
          recordEventImpact(eventHistory, "requirement", loaded.event.payload.requirement_id, loaded.event.id);
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
        if (!entityIds.acceptance_criterion.has(loaded.event.payload.acceptance_criterion_id)) {
          errors.push({
            path: loaded.path,
            message: `AcceptanceCriterionChanged references missing acceptance criterion '${loaded.event.payload.acceptance_criterion_id}'`,
          });
        } else {
          recordEventImpact(eventHistory, "acceptance_criterion", loaded.event.payload.acceptance_criterion_id, loaded.event.id);
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
        if (!entityIds.feature.has(loaded.event.payload.feature_id)) {
          errors.push({
            path: loaded.path,
            message: `FeatureMovedToCapability references missing feature '${loaded.event.payload.feature_id}'`,
          });
        }
        if (!entityIds.capability.has(loaded.event.payload.capability_id)) {
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
        } else if (currentCapabilityId && entityIds.capability.has(loaded.event.payload.capability_id)) {
          currentFeatureCapabilities.set(loaded.event.payload.feature_id, loaded.event.payload.capability_id);
        }

        if (entityIds.feature.has(loaded.event.payload.feature_id)) {
          recordEventImpact(eventHistory, "feature", loaded.event.payload.feature_id, loaded.event.id);
        }
        if (currentCapabilityId && entityIds.capability.has(currentCapabilityId)) {
          recordEventImpact(eventHistory, "capability", currentCapabilityId, loaded.event.id);
        }
        if (entityIds.capability.has(loaded.event.payload.capability_id)) {
          recordEventImpact(eventHistory, "capability", loaded.event.payload.capability_id, loaded.event.id);
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
        if (!entityIds.feature.has(loaded.event.payload.feature_id)) {
          errors.push({
            path: loaded.path,
            message: `FeatureDeprecated references missing feature '${loaded.event.payload.feature_id}'`,
          });
        } else {
          recordEventImpact(eventHistory, "feature", loaded.event.payload.feature_id, loaded.event.id);
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
        if (!entityIds.feature.has(loaded.event.payload.feature_id)) {
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
        if (entityIds.feature.has(loaded.event.payload.feature_id)) {
          recordEventImpact(eventHistory, "feature", loaded.event.payload.feature_id, loaded.event.id);
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
        if (!entityIds.capability.has(loaded.event.payload.capability_id)) {
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
        if (entityIds.capability.has(loaded.event.payload.capability_id)) {
          recordEventImpact(eventHistory, "capability", loaded.event.payload.capability_id, loaded.event.id);
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
        recordUniqueEntity(entityIds.test, loaded.event.payload.test_id, loaded.path, "test", errors);
        if (!entityIds.acceptance_criterion.has(loaded.event.payload.acceptance_criterion_id)) {
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

        recordEventImpact(eventHistory, "test", loaded.event.payload.test_id, loaded.event.id);
        if (entityIds.acceptance_criterion.has(loaded.event.payload.acceptance_criterion_id)) {
          recordEventImpact(eventHistory, "acceptance_criterion", loaded.event.payload.acceptance_criterion_id, loaded.event.id);
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

function validateConcurrencyPreconditions(
  loaded: LoadedEvent,
  entityIds: EntityIdMaps,
  eventHistory: EntityEventHistory,
  errors: ValidationError[],
): void {
  const preconditions = loaded.event.metadata?.concurrency?.preconditions ?? [];
  const seen = new Set<string>();

  for (const precondition of preconditions) {
    const key = `${precondition.entity_type}:${precondition.entity_id}`;
    if (seen.has(key)) {
      errors.push({
        path: loaded.path,
        message: `Duplicate concurrency precondition for ${precondition.entity_type} '${precondition.entity_id}'`,
      });
      continue;
    }
    seen.add(key);

    if (!entityIds[precondition.entity_type].has(precondition.entity_id)) {
      errors.push({
        path: loaded.path,
        message: `Concurrency precondition references missing ${precondition.entity_type} '${precondition.entity_id}'`,
      });
      continue;
    }

    if (precondition.expected_last_entity_event_id) {
      const affectingEventIds = eventHistory[precondition.entity_type].get(precondition.entity_id) ?? [];
      if (!affectingEventIds.includes(precondition.expected_last_entity_event_id)) {
        errors.push({
          path: loaded.path,
          message: `Concurrency precondition expected_last_entity_event_id '${precondition.expected_last_entity_event_id}' does not reference a prior event affecting ${precondition.entity_type} '${precondition.entity_id}'`,
        });
      }
    }
  }
}

function createEntityEventHistory(): EntityEventHistory {
  return {
    product: new Map<string, string[]>(),
    capability: new Map<string, string[]>(),
    feature: new Map<string, string[]>(),
    requirement: new Map<string, string[]>(),
    acceptance_criterion: new Map<string, string[]>(),
    test: new Map<string, string[]>(),
  };
}

function recordEventImpact(
  history: EntityEventHistory,
  entityType: EntityType,
  entityId: string,
  eventId: string,
): void {
  const current = history[entityType].get(entityId) ?? [];
  history[entityType].set(entityId, [...current, eventId]);
}

async function validateTestSource(loaded: LoadedEvent): Promise<ValidationError[]> {
  if (loaded.event.type !== "TestCreated") {
    return [];
  }

  const errors: ValidationError[] = [];
  const payload = loaded.event.payload;
  const filePath = path.resolve(process.cwd(), payload.file_path);

  try {
    const content = await readFile(filePath, "utf8");
    const lines = content.split(/\r?\n/);
    const match = lines
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => line.includes(payload.test_name));

    if (match.length === 0) {
      errors.push({
        path: loaded.path,
        message: `Could not find a test line containing '${payload.test_name}' in '${payload.file_path}'`,
      });
      return errors;
    }

    if (match.length > 1) {
      errors.push({
        path: loaded.path,
        message: `Found multiple test lines containing '${payload.test_name}' in '${payload.file_path}'`,
      });
      return errors;
    }

    const testLineIndex = match[0].index;
    const annotationLine = lines[testLineIndex - 1] ?? "";
    const acceptanceCriterionId = payload.acceptance_criterion_id;
    if (!annotationLine.includes(`AC: ${acceptanceCriterionId}`)
      && !annotationLine.includes(`, ${acceptanceCriterionId}`)
      && !annotationLine.includes(`${acceptanceCriterionId},`)) {
      errors.push({
        path: loaded.path,
        message: `Expected AC annotation immediately above test '${payload.test_name}' in '${payload.file_path}'`,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push({
      path: loaded.path,
      message: `Could not validate linked test source '${payload.file_path}': ${message}`,
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
