import path from "node:path";
import { compareLoadedEvents, validateEvents, validateLoadedEvents } from "../validation/validateEvents.js";
import { replayEvents } from "../projection/replay.js";
import { getCurrentBranchName, loadGitBranchEvents } from "./gitEvents.js";
import type {
  BranchDeltaCapabilityContext,
  BranchDeltaChangeCategory,
  BranchDeltaChangedEntities,
  BranchDeltaContext,
  BranchDeltaEntityRefs,
  BranchDeltaFeatureContext,
  BranchDeltaImpactedEntities,
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
  const impactedEntities = buildImpactedEntities(changedEntities, currentState);
  const contextualChanges = buildContextualChanges(changedEntities, currentState);
  const summary = summarizeChangedEntities(changedEntities);
  const changeCategories = inferChangeCategories(branchOnlyEvents, changedEntities);

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
    impacted_entities: impactedEntities,
    contextual_changes: contextualChanges,
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
      case "FeatureChanged":
        changedEntities.features.changed.push({ feature_id: event.payload.feature_id });
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

  const addedCapabilityIds = new Set(changedEntities.capabilities.added.map((item) => item.capability_id));
  changedEntities.capabilities.status_changed = changedEntities.capabilities.status_changed.filter(
    (item) => !addedCapabilityIds.has(item.capability_id),
  );

  const addedFeatureIds = new Set(changedEntities.features.added.map((item) => item.feature_id));
  changedEntities.features.changed = changedEntities.features.changed.filter(
    (item) => !addedFeatureIds.has(item.feature_id),
  );
  changedEntities.features.moved = changedEntities.features.moved.filter(
    (item) => !addedFeatureIds.has(item.feature_id),
  );
  changedEntities.features.deprecated = changedEntities.features.deprecated.filter(
    (item) => !addedFeatureIds.has(item.feature_id),
  );
  changedEntities.features.status_changed = changedEntities.features.status_changed.filter(
    (item) => !addedFeatureIds.has(item.feature_id),
  );

  const addedRequirementIds = new Set(changedEntities.requirements.added.map((item) => item.requirement_id));
  changedEntities.requirements.changed = changedEntities.requirements.changed.filter(
    (item) => !addedRequirementIds.has(item.requirement_id),
  );

  const addedAcceptanceCriterionIds = new Set(
    changedEntities.acceptance_criteria.added.map((item) => item.acceptance_criterion_id),
  );
  changedEntities.acceptance_criteria.changed = changedEntities.acceptance_criteria.changed.filter(
    (item) => !addedAcceptanceCriterionIds.has(item.acceptance_criterion_id),
  );

  return changedEntities;
}

function buildImpactedEntities(
  changedEntities: BranchDeltaChangedEntities,
  state: ReturnType<typeof replayEvents>,
): BranchDeltaImpactedEntities {
  const capabilityIds = new Set<string>();
  const featureIds = new Set<string>();
  const requirementIds = new Set<string>();
  const acceptanceCriterionIds = new Set<string>();
  const testIds = new Set<string>();

  const addCapabilityImpact = (capabilityId: string): void => {
    if (capabilityIds.has(capabilityId)) {
      return;
    }
    capabilityIds.add(capabilityId);

    const capability = state.capabilities.get(capabilityId);
    if (!capability) {
      return;
    }

    for (const featureId of capability.featureIds) {
      addFeatureImpact(featureId);
    }
  };

  const addFeatureImpact = (featureId: string): void => {
    if (featureIds.has(featureId)) {
      return;
    }
    featureIds.add(featureId);

    const feature = state.features.get(featureId);
    if (!feature) {
      return;
    }

    capabilityIds.add(feature.capabilityId);
    for (const requirementId of feature.requirementIds) {
      addRequirementImpact(requirementId);
    }
  };

  const addRequirementImpact = (requirementId: string): void => {
    if (requirementIds.has(requirementId)) {
      return;
    }
    requirementIds.add(requirementId);

    const requirement = state.requirements.get(requirementId);
    if (!requirement) {
      return;
    }

    addFeatureImpact(requirement.featureId);
    for (const acceptanceCriterionId of requirement.acceptanceCriterionIds) {
      addAcceptanceCriterionImpact(acceptanceCriterionId);
    }
  };

  const addAcceptanceCriterionImpact = (acceptanceCriterionId: string): void => {
    if (acceptanceCriterionIds.has(acceptanceCriterionId)) {
      return;
    }
    acceptanceCriterionIds.add(acceptanceCriterionId);

    const acceptanceCriterion = state.acceptanceCriteria.get(acceptanceCriterionId);
    if (!acceptanceCriterion) {
      return;
    }

    addRequirementImpact(acceptanceCriterion.requirementId);
    for (const test of state.tests.values()) {
      if (test.acceptanceCriterionId === acceptanceCriterionId) {
        testIds.add(test.id);
      }
    }
  };

  const addTestImpact = (testId: string): void => {
    if (testIds.has(testId)) {
      return;
    }
    testIds.add(testId);

    const test = state.tests.get(testId);
    if (!test) {
      return;
    }

    addAcceptanceCriterionImpact(test.acceptanceCriterionId);
  };

  for (const capability of changedEntities.capabilities.added) {
    addCapabilityImpact(capability.capability_id);
  }
  for (const capability of changedEntities.capabilities.changed) {
    addCapabilityImpact(capability.capability_id);
  }
  for (const capability of changedEntities.capabilities.status_changed) {
    addCapabilityImpact(capability.capability_id);
  }

  for (const feature of changedEntities.features.added) {
    addFeatureImpact(feature.feature_id);
  }
  for (const feature of changedEntities.features.changed) {
    addFeatureImpact(feature.feature_id);
  }
  for (const feature of changedEntities.features.moved) {
    addFeatureImpact(feature.feature_id);
    if (feature.from_capability_id) {
      capabilityIds.add(feature.from_capability_id);
    }
    capabilityIds.add(feature.to_capability_id);
  }
  for (const feature of changedEntities.features.deprecated) {
    addFeatureImpact(feature.feature_id);
  }
  for (const feature of changedEntities.features.status_changed) {
    addFeatureImpact(feature.feature_id);
  }

  for (const requirement of changedEntities.requirements.added) {
    addRequirementImpact(requirement.requirement_id);
  }
  for (const requirement of changedEntities.requirements.changed) {
    addRequirementImpact(requirement.requirement_id);
  }

  for (const acceptanceCriterion of changedEntities.acceptance_criteria.added) {
    addAcceptanceCriterionImpact(acceptanceCriterion.acceptance_criterion_id);
  }
  for (const acceptanceCriterion of changedEntities.acceptance_criteria.changed) {
    addAcceptanceCriterionImpact(acceptanceCriterion.acceptance_criterion_id);
  }

  for (const test of changedEntities.tests.added) {
    addTestImpact(test.test_id);
  }

  return {
    capability_ids: [...capabilityIds].sort(),
    feature_ids: [...featureIds].sort(),
    requirement_ids: [...requirementIds].sort(),
    acceptance_criterion_ids: [...acceptanceCriterionIds].sort(),
    test_ids: [...testIds].sort(),
  };
}

function buildContextualChanges(
  changedEntities: BranchDeltaChangedEntities,
  state: ReturnType<typeof replayEvents>,
): BranchDeltaContext {
  const changedCapabilityIds = new Set([
    ...changedEntities.capabilities.added.map((item) => item.capability_id),
    ...changedEntities.capabilities.changed.map((item) => item.capability_id),
    ...changedEntities.capabilities.status_changed.map((item) => item.capability_id),
  ]);
  const changedFeatureIds = new Set([
    ...changedEntities.features.added.map((item) => item.feature_id),
    ...changedEntities.features.changed.map((item) => item.feature_id),
    ...changedEntities.features.moved.map((item) => item.feature_id),
    ...changedEntities.features.deprecated.map((item) => item.feature_id),
    ...changedEntities.features.status_changed.map((item) => item.feature_id),
  ]);
  const changedRequirementIds = new Set([
    ...changedEntities.requirements.added.map((item) => item.requirement_id),
    ...changedEntities.requirements.changed.map((item) => item.requirement_id),
  ]);
  const changedAcceptanceCriterionIds = new Set([
    ...changedEntities.acceptance_criteria.added.map((item) => item.acceptance_criterion_id),
    ...changedEntities.acceptance_criteria.changed.map((item) => item.acceptance_criterion_id),
  ]);
  const changedTestIds = new Set(changedEntities.tests.added.map((item) => item.test_id));

  const featureMoveById = new Map(changedEntities.features.moved.map((item) => [item.feature_id, item]));
  const featureDeprecationById = new Map(changedEntities.features.deprecated.map((item) => [item.feature_id, item]));
  const featureStatusById = new Map(changedEntities.features.status_changed.map((item) => [item.feature_id, item]));
  const capabilityStatusById = new Map(changedEntities.capabilities.status_changed.map((item) => [item.capability_id, item]));

  const capabilitiesById = new Map<string, BranchDeltaCapabilityContext>();
  const featuresById = new Map<string, BranchDeltaFeatureContext>();

  const ensureCapability = (capabilityId: string): BranchDeltaCapabilityContext => {
    const existing = capabilitiesById.get(capabilityId);
    if (existing) {
      return existing;
    }

    const capability = state.capabilities.get(capabilityId);
    if (!capability) {
      throw new Error(`Missing capability '${capabilityId}' while building branch delta context`);
    }

    const notes: string[] = [];
    if (changedEntities.capabilities.added.some((item) => item.capability_id === capabilityId)) {
      notes.push("added");
    }
    const capabilityStatus = capabilityStatusById.get(capabilityId);
    if (capabilityStatus) {
      notes.push(`status -> ${capabilityStatus.status}`);
    }

    const next: BranchDeltaCapabilityContext = {
      capability_id: capability.id,
      capability_name: capability.name,
      description: capability.description,
      change_notes: notes,
      features: [],
    };
    capabilitiesById.set(capabilityId, next);
    return next;
  };

  const ensureFeature = (featureId: string): BranchDeltaFeatureContext => {
    const existing = featuresById.get(featureId);
    if (existing) {
      return existing;
    }

    const feature = state.features.get(featureId);
    if (!feature) {
      throw new Error(`Missing feature '${featureId}' while building branch delta context`);
    }

    const capabilityContext = ensureCapability(feature.capabilityId);
    const notes: string[] = [];
    if (changedEntities.features.added.some((item) => item.feature_id === featureId)) {
      notes.push("added");
    }
    const move = featureMoveById.get(featureId);
    if (move) {
      notes.push(`moved from ${move.from_capability_id ?? "unknown"} to ${move.to_capability_id}`);
    }
    const deprecation = featureDeprecationById.get(featureId);
    if (deprecation) {
      notes.push(`deprecated: ${deprecation.reason}`);
    }
    const status = featureStatusById.get(featureId);
    if (status) {
      notes.push(`status -> ${status.status}`);
    }

    const next: BranchDeltaFeatureContext = {
      feature_id: feature.id,
      feature_name: feature.name,
      description: feature.description,
      change_notes: notes,
      requirements: [],
    };
    capabilityContext.features.push(next);
    featuresById.set(featureId, next);
    return next;
  };

  const ensureRequirement = (requirementId: string) => {
    const requirement = state.requirements.get(requirementId);
    if (!requirement) {
      throw new Error(`Missing requirement '${requirementId}' while building branch delta context`);
    }

    const featureContext = ensureFeature(requirement.featureId);
    let existing = featureContext.requirements.find((item) => item.requirement_id === requirementId);
    if (existing) {
      return existing;
    }

    const notes: string[] = [];
    if (changedEntities.requirements.added.some((item) => item.requirement_id === requirementId)) {
      notes.push("added");
    }
    if (changedEntities.requirements.changed.some((item) => item.requirement_id === requirementId)) {
      notes.push("changed");
    }

    existing = {
      requirement_id: requirement.id,
      description: requirement.description,
      change_notes: notes,
      acceptance_criteria: [],
    };
    featureContext.requirements.push(existing);
    return existing;
  };

  const ensureAcceptanceCriterion = (acceptanceCriterionId: string) => {
    const acceptanceCriterion = state.acceptanceCriteria.get(acceptanceCriterionId);
    if (!acceptanceCriterion) {
      throw new Error(`Missing acceptance criterion '${acceptanceCriterionId}' while building branch delta context`);
    }

    const requirementContext = ensureRequirement(acceptanceCriterion.requirementId);
    let existing = requirementContext.acceptance_criteria.find((item) => item.acceptance_criterion_id === acceptanceCriterionId);
    if (existing) {
      return existing;
    }

    const notes: string[] = [];
    if (changedEntities.acceptance_criteria.added.some((item) => item.acceptance_criterion_id === acceptanceCriterionId)) {
      notes.push("added");
    }
    if (changedEntities.acceptance_criteria.changed.some((item) => item.acceptance_criterion_id === acceptanceCriterionId)) {
      notes.push("changed");
    }

    existing = {
      acceptance_criterion_id: acceptanceCriterion.id,
      text: acceptanceCriterion.text,
      change_notes: notes,
      tests: [],
    };
    requirementContext.acceptance_criteria.push(existing);
    return existing;
  };

  const addTestToContext = (testId: string): void => {
    const test = state.tests.get(testId);
    if (!test) {
      throw new Error(`Missing test '${testId}' while building branch delta context`);
    }

    const acceptanceCriterionContext = ensureAcceptanceCriterion(test.acceptanceCriterionId);
    if (!acceptanceCriterionContext.tests.some((item) => item.test_id === testId)) {
      acceptanceCriterionContext.tests.push({ test_id: test.id });
    }
  };

  for (const capabilityId of changedCapabilityIds) {
    ensureCapability(capabilityId);
  }
  for (const featureId of changedFeatureIds) {
    ensureFeature(featureId);
  }
  for (const requirementId of changedRequirementIds) {
    ensureRequirement(requirementId);
  }
  for (const acceptanceCriterionId of changedAcceptanceCriterionIds) {
    ensureAcceptanceCriterion(acceptanceCriterionId);
  }
  for (const testId of changedTestIds) {
    addTestToContext(testId);
  }

  const capabilities = [...capabilitiesById.values()]
    .map((capability) => ({
      ...capability,
      features: [...capability.features]
        .map((feature) => ({
          ...feature,
          requirements: [...feature.requirements]
            .map((requirement) => ({
              ...requirement,
              acceptance_criteria: [...requirement.acceptance_criteria]
                .map((acceptanceCriterion) => ({
                  ...acceptanceCriterion,
                  tests: [...acceptanceCriterion.tests].sort((a, b) => a.test_id.localeCompare(b.test_id)),
                }))
                .sort((a, b) => a.acceptance_criterion_id.localeCompare(b.acceptance_criterion_id)),
            }))
            .sort((a, b) => a.requirement_id.localeCompare(b.requirement_id)),
        }))
        .sort((a, b) => a.feature_id.localeCompare(b.feature_id)),
    }))
    .sort((a, b) => a.capability_id.localeCompare(b.capability_id));

  return { capabilities };
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
  changedEntities: BranchDeltaChangedEntities,
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
      case "FeatureChanged":
      case "RequirementChanged":
      case "AcceptanceCriterionChanged":
        break;
      case "FeatureMovedToCapability":
        break;
      case "FeatureDeprecated":
        break;
      case "TestCreated":
        categories.add("verify");
        break;
      case "FeatureStatusChanged":
      case "CapabilityStatusChanged":
        break;
      case "ProductCreated":
        categories.add("extend");
        break;
      default:
        assertNever(event);
    }
  }

  if (
    changedEntities.features.changed.length > 0
    || changedEntities.requirements.changed.length > 0
    || changedEntities.acceptance_criteria.changed.length > 0
  ) {
    categories.add("refine");
  }
  if (changedEntities.features.moved.length > 0) {
    categories.add("reshape");
  }
  if (changedEntities.features.deprecated.length > 0) {
    categories.add("deprecate");
  }
  if (
    changedEntities.features.status_changed.length > 0
    || changedEntities.capabilities.status_changed.length > 0
  ) {
    categories.add("readiness");
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
    case "FeatureChanged":
      return {
        ...emptyEntityRefs(),
        feature_ids: [event.payload.feature_id],
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
