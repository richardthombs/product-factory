import { readFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { ZodError } from "zod";
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

  const sortedEvents = [...parsed].sort(compareLoadedEvents);
  errors.push(...await validateRepositoryRules(sortedEvents, eventsRoot));

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

function compareLoadedEvents(a: LoadedEvent, b: LoadedEvent): number {
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
          String(loaded.event.payload.line_number),
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
    const lineIndex = loaded.event.payload.line_number - 1;

    if (lineIndex < 0 || lineIndex >= lines.length) {
      errors.push({
        path: loaded.path,
        message: `Linked test line ${loaded.event.payload.line_number} is outside file '${loaded.event.payload.file_path}'`,
      });
      return errors;
    }

    const testLine = lines[lineIndex] ?? "";
    if (!testLine.includes(loaded.event.payload.test_name)) {
      errors.push({
        path: loaded.path,
        message: `Linked test line ${loaded.event.payload.line_number} in '${loaded.event.payload.file_path}' does not contain test name '${loaded.event.payload.test_name}'`,
      });
    }

    const annotationLine = lines[lineIndex - 1] ?? "";
    const acceptanceCriterionId = loaded.event.payload.acceptance_criterion_id;
    if (!annotationLine.includes(`AC: ${acceptanceCriterionId}`)
      && !annotationLine.includes(`, ${acceptanceCriterionId}`)
      && !annotationLine.includes(`${acceptanceCriterionId},`)) {
      errors.push({
        path: loaded.path,
        message: `Expected AC annotation immediately above line ${loaded.event.payload.line_number} in '${loaded.event.payload.file_path}'`,
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
      TestCreated: 0,
    },
  );
}
