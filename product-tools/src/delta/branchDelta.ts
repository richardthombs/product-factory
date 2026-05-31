import path from "node:path";
import { compareLoadedEvents, validateEvents, validateLoadedEvents } from "../validation/validateEvents.js";
import { replayEvents } from "../projection/replay.js";
import { getCurrentBranchName, loadGitBranchEvents } from "./gitEvents.js";
import type {
  BranchDeltaChangeCategory,
  BranchDeltaChangedEntities,
  BranchDeltaEntityRefs,
  BranchDeltaOptions,
  BranchDeltaReport,
  BranchDeltaSummary,
} from "./types.js";

export async function branchDelta(options: BranchDeltaOptions): Promise<BranchDeltaReport> {
  const cwd = options.cwd ?? process.cwd();
  const eventsRoot = path.resolve(cwd, options.eventsRoot ?? "product-events");
  const currentValidation = await validateEvents(eventsRoot);
  if (currentValidation.errors.length > 0) {
    const details = currentValidation.errors.map((error) => `- ${error.path}: ${error.message}`).join("\n");
    throw new Error(`Current branch events are invalid:\n${details}`);
  }

  const baseLoadedEvents = await loadGitBranchEvents(options.baseBranch, eventsRoot, cwd);
  const baseValidation = await validateLoadedEvents(baseLoadedEvents, `${options.baseBranch}:${eventsRoot}`);
  if (baseValidation.errors.length > 0) {
    const details = baseValidation.errors.map((error) => `- ${error.path}: ${error.message}`).join("\n");
    throw new Error(`Base branch events are invalid:\n${details}`);
  }

  const baseEventIds = new Set(baseValidation.events.map(({ event }) => event.id));
  const branchOnlyEvents = currentValidation.events
    .filter(({ event }) => !baseEventIds.has(event.id))
    .sort(compareLoadedEvents);

  const currentState = replayEvents(currentValidation.events);
  const baseState = replayEvents(baseValidation.events);
  const changedEntities = buildChangedEntities(branchOnlyEvents, baseState);
  const summary = summarizeChangedEntities(changedEntities);
  const changeCategories = inferChangeCategories(branchOnlyEvents);

  return {
    base_branch: options.baseBranch,
    current_branch: await getCurrentBranchName(cwd),
    product_id: currentState.product.id,
    events_root: path.relative(cwd, eventsRoot).replaceAll("\\", "/") || "product-events",
    base_event_count: baseValidation.events.length,
    current_event_count: currentValidation.events.length,
    branch_only_event_count: branchOnlyEvents.length,
    summary,
    change_categories: changeCategories,
    branch_only_events: branchOnlyEvents.map(({ path: filePath, event }) => ({
      event_id: event.id,
      event_type: event.type,
      file_path: path.relative(cwd, filePath).replaceAll("\\", "/"),
      occurred_at: event.occurred_at,
      entity_refs: entityRefsForEvent(event),
    })),
    changed_entities: changedEntities,
  };
}

function buildChangedEntities(
  branchOnlyEvents: Awaited<ReturnType<typeof validateEvents>>["events"],
  baseState: ReturnType<typeof replayEvents>,
): BranchDeltaChangedEntities {
  const changedEntities: BranchDeltaChangedEntities = {
    capabilities: {
      added: [],
      changed: [],
      status_changed: [],
    },
    features: {
      added: [],
      changed: [],
      moved: [],
      deprecated: [],
      status_changed: [],
    },
    requirements: {
      added: [],
      changed: [],
    },
    acceptance_criteria: {
      added: [],
      changed: [],
    },
    tests: {
      added: [],
    },
  };

  const currentFeatureCapabilities = new Map(
    [...baseState.features.values()].map((feature) => [feature.id, feature.capabilityId]),
  );

  for (const { event } of branchOnlyEvents) {
    switch (event.type) {
      case "ProductCreated":
        break;
      case "CapabilityAdded":
        changedEntities.capabilities.added.push({ capability_id: event.payload.capability_id });
        break;
      case "FeatureAdded":
        changedEntities.features.added.push({ feature_id: event.payload.feature_id });
        currentFeatureCapabilities.set(event.payload.feature_id, event.payload.capability_id);
        break;
      case "RequirementAdded":
        changedEntities.requirements.added.push({ requirement_id: event.payload.requirement_id });
        break;
      case "AcceptanceCriterionAdded":
        changedEntities.acceptance_criteria.added.push({ acceptance_criterion_id: event.payload.acceptance_criterion_id });
        break;
      case "RequirementChanged":
        changedEntities.requirements.changed.push({ requirement_id: event.payload.requirement_id });
        break;
      case "AcceptanceCriterionChanged":
        changedEntities.acceptance_criteria.changed.push({ acceptance_criterion_id: event.payload.acceptance_criterion_id });
        break;
      case "FeatureMovedToCapability": {
        const fromCapabilityId = currentFeatureCapabilities.get(event.payload.feature_id) ?? null;
        changedEntities.features.moved.push({
          feature_id: event.payload.feature_id,
          from_capability_id: fromCapabilityId,
          to_capability_id: event.payload.capability_id,
        });
        currentFeatureCapabilities.set(event.payload.feature_id, event.payload.capability_id);
        break;
      }
      case "FeatureDeprecated":
        changedEntities.features.deprecated.push({
          feature_id: event.payload.feature_id,
          reason: event.payload.reason,
        });
        break;
      case "FeatureStatusChanged":
        changedEntities.features.status_changed.push({
          feature_id: event.payload.feature_id,
          status: event.payload.status,
        });
        break;
      case "CapabilityStatusChanged":
        changedEntities.capabilities.status_changed.push({
          capability_id: event.payload.capability_id,
          status: event.payload.status,
        });
        break;
      case "TestCreated":
        changedEntities.tests.added.push({ test_id: event.payload.test_id });
        break;
      default:
        assertNever(event);
    }
  }

  return changedEntities;
}

function summarizeChangedEntities(changedEntities: BranchDeltaChangedEntities): BranchDeltaSummary {
  return {
    capabilities_added: changedEntities.capabilities.added.length,
    capabilities_changed: changedEntities.capabilities.changed.length,
    capabilities_status_changed: changedEntities.capabilities.status_changed.length,
    features_added: changedEntities.features.added.length,
    features_changed: changedEntities.features.changed.length,
    features_moved: changedEntities.features.moved.length,
    features_deprecated: changedEntities.features.deprecated.length,
    features_status_changed: changedEntities.features.status_changed.length,
    requirements_added: changedEntities.requirements.added.length,
    requirements_changed: changedEntities.requirements.changed.length,
    acceptance_criteria_added: changedEntities.acceptance_criteria.added.length,
    acceptance_criteria_changed: changedEntities.acceptance_criteria.changed.length,
    tests_added: changedEntities.tests.added.length,
  };
}

function inferChangeCategories(
  branchOnlyEvents: Awaited<ReturnType<typeof validateEvents>>["events"],
): BranchDeltaChangeCategory[] {
  const categoryOrder: BranchDeltaChangeCategory[] = [
    "extend",
    "refine",
    "reshape",
    "deprecate",
    "verify",
    "readiness",
  ];
  const categories = new Set<BranchDeltaChangeCategory>();

  for (const { event } of branchOnlyEvents) {
    switch (event.type) {
      case "CapabilityAdded":
      case "FeatureAdded":
      case "RequirementAdded":
      case "AcceptanceCriterionAdded":
        categories.add("extend");
        break;
      case "RequirementChanged":
      case "AcceptanceCriterionChanged":
        categories.add("refine");
        break;
      case "FeatureMovedToCapability":
        categories.add("reshape");
        break;
      case "FeatureDeprecated":
        categories.add("deprecate");
        break;
      case "TestCreated":
        categories.add("verify");
        break;
      case "FeatureStatusChanged":
      case "CapabilityStatusChanged":
        categories.add("readiness");
        break;
      case "ProductCreated":
        categories.add("extend");
        break;
      default:
        assertNever(event);
    }
  }

  return categoryOrder.filter((category) => categories.has(category));
}

function entityRefsForEvent(event: Awaited<ReturnType<typeof validateEvents>>["events"][number]["event"]): BranchDeltaEntityRefs {
  switch (event.type) {
    case "ProductCreated":
      return emptyEntityRefs();
    case "CapabilityAdded":
    case "CapabilityStatusChanged":
      return {
        ...emptyEntityRefs(),
        capability_ids: [event.payload.capability_id],
      };
    case "FeatureAdded":
      return {
        ...emptyEntityRefs(),
        capability_ids: [event.payload.capability_id],
        feature_ids: [event.payload.feature_id],
      };
    case "RequirementAdded":
      return {
        ...emptyEntityRefs(),
        feature_ids: [event.payload.feature_id],
        requirement_ids: [event.payload.requirement_id],
      };
    case "AcceptanceCriterionAdded":
      return {
        ...emptyEntityRefs(),
        requirement_ids: [event.payload.requirement_id],
        acceptance_criterion_ids: [event.payload.acceptance_criterion_id],
      };
    case "RequirementChanged":
      return {
        ...emptyEntityRefs(),
        requirement_ids: [event.payload.requirement_id],
      };
    case "AcceptanceCriterionChanged":
      return {
        ...emptyEntityRefs(),
        acceptance_criterion_ids: [event.payload.acceptance_criterion_id],
      };
    case "FeatureMovedToCapability":
      return {
        ...emptyEntityRefs(),
        capability_ids: [event.payload.capability_id],
        feature_ids: [event.payload.feature_id],
      };
    case "FeatureDeprecated":
    case "FeatureStatusChanged":
      return {
        ...emptyEntityRefs(),
        feature_ids: [event.payload.feature_id],
      };
    case "TestCreated":
      return {
        ...emptyEntityRefs(),
        acceptance_criterion_ids: [event.payload.acceptance_criterion_id],
        test_ids: [event.payload.test_id],
      };
    default:
      return assertNever(event);
  }
}

function emptyEntityRefs(): BranchDeltaEntityRefs {
  return {
    capability_ids: [],
    feature_ids: [],
    requirement_ids: [],
    acceptance_criterion_ids: [],
    test_ids: [],
  };
}

function assertNever(value: never): never {
  throw new Error(`Unexpected event type in branch delta: ${JSON.stringify(value)}`);
}
