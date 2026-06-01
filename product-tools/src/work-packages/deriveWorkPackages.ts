import path from "node:path";
import { branchDelta } from "../delta/branchDelta.js";
import { replayEvents } from "../projection/replay.js";
import type { ProductModelState } from "../projection/types.js";
import { validateEvents } from "../validation/validateEvents.js";
import type { DeriveWorkPackagesOptions, WorkPackage, WorkPackageReport } from "./types.js";

type DraftWorkPackage = {
  key: string;
  kind: "feature" | "capability";
  sort_key: string;
  capability_ids: Set<string>;
  feature_ids: Set<string>;
  requirement_ids: Set<string>;
  acceptance_criterion_ids: Set<string>;
  test_ids: Set<string>;
  depends_on: Set<string>;
};

type ChangedEntitySets = {
  capabilities: {
    added: Set<string>;
    changed: Set<string>;
    status_changed: Set<string>;
  };
  features: {
    added: Set<string>;
    changed: Set<string>;
    moved: Map<string, { from_capability_id: string | null; to_capability_id: string }>;
    deprecated: Map<string, string>;
    status_changed: Map<string, string>;
  };
  requirements: {
    added: Set<string>;
    changed: Set<string>;
  };
  acceptance_criteria: {
    added: Set<string>;
    changed: Set<string>;
  };
  tests: {
    added: Set<string>;
  };
};

const CHANGE_SUMMARY_ORDER = [
  "add capability",
  "capability status transition",
  "add feature",
  "change feature",
  "move feature",
  "deprecate feature",
  "feature status transition",
  "add requirements",
  "refine requirements",
  "add acceptance criteria",
  "refine acceptance criteria",
  "add tests",
] as const;

export async function deriveWorkPackages(options: DeriveWorkPackagesOptions): Promise<WorkPackageReport> {
  const cwd = options.cwd ?? process.cwd();
  const eventsRoot = path.resolve(cwd, options.eventsRoot ?? "product-events");
  const delta = await branchDelta(options);
  const validation = await validateEvents(eventsRoot);
  if (validation.errors.length > 0) {
    const details = validation.errors.map((error) => `- ${error.path}: ${error.message}`).join("\n");
    throw new Error(`Current branch events are invalid:\n${details}`);
  }

  const state = replayEvents(validation.events);
  const changed = toChangedEntitySets(delta);
  const testsByAcceptanceCriterion = buildTestsByAcceptanceCriterion(state);
  const featurePackages = new Map<string, DraftWorkPackage>();
  const capabilityPackages = new Map<string, DraftWorkPackage>();

  const ensureFeaturePackage = (featureId: string): DraftWorkPackage => {
    const key = `feature:${featureId}`;
    const existing = featurePackages.get(key);
    if (existing) {
      return existing;
    }

    const feature = state.features.get(featureId);
    if (!feature) {
      throw new Error(`Missing feature '${featureId}' while deriving work packages`);
    }

    const next: DraftWorkPackage = {
      key,
      kind: "feature",
      sort_key: feature.id,
      capability_ids: new Set([feature.capabilityId]),
      feature_ids: new Set([feature.id]),
      requirement_ids: new Set(),
      acceptance_criterion_ids: new Set(),
      test_ids: new Set(),
      depends_on: new Set(),
    };
    featurePackages.set(key, next);
    return next;
  };

  const ensureCapabilityPackage = (capabilityId: string): DraftWorkPackage => {
    const key = `capability:${capabilityId}`;
    const existing = capabilityPackages.get(key);
    if (existing) {
      return existing;
    }

    const capability = state.capabilities.get(capabilityId);
    if (!capability) {
      throw new Error(`Missing capability '${capabilityId}' while deriving work packages`);
    }

    const next: DraftWorkPackage = {
      key,
      kind: "capability",
      sort_key: capability.id,
      capability_ids: new Set([capability.id]),
      feature_ids: new Set(),
      requirement_ids: new Set(),
      acceptance_criterion_ids: new Set(),
      test_ids: new Set(),
      depends_on: new Set(),
    };
    capabilityPackages.set(key, next);
    return next;
  };

  for (const featureId of changed.features.added) {
    addFeatureScope(ensureFeaturePackage(featureId), featureId, state, testsByAcceptanceCriterion);
  }
  for (const featureId of changed.features.changed) {
    addFeatureScope(ensureFeaturePackage(featureId), featureId, state, testsByAcceptanceCriterion);
  }
  for (const [featureId, move] of changed.features.moved) {
    const draft = ensureFeaturePackage(featureId);
    addFeatureScope(draft, featureId, state, testsByAcceptanceCriterion);
    if (move.from_capability_id) {
      draft.capability_ids.add(move.from_capability_id);
    }
    draft.capability_ids.add(move.to_capability_id);
  }
  for (const featureId of changed.features.deprecated.keys()) {
    addFeatureScope(ensureFeaturePackage(featureId), featureId, state, testsByAcceptanceCriterion);
  }
  for (const featureId of changed.features.status_changed.keys()) {
    addFeatureScope(ensureFeaturePackage(featureId), featureId, state, testsByAcceptanceCriterion);
  }

  for (const requirementId of changed.requirements.added) {
    addRequirementScopeForChangedEntity(ensureFeaturePackage(requireFeatureId(state, requirementId)), requirementId, state, testsByAcceptanceCriterion);
  }
  for (const requirementId of changed.requirements.changed) {
    addRequirementScopeForChangedEntity(ensureFeaturePackage(requireFeatureId(state, requirementId)), requirementId, state, testsByAcceptanceCriterion);
  }

  for (const acceptanceCriterionId of changed.acceptance_criteria.added) {
    addAcceptanceCriterionScopeForChangedEntity(
      ensureFeaturePackage(requireFeatureIdForAcceptanceCriterion(state, acceptanceCriterionId)),
      acceptanceCriterionId,
      state,
      testsByAcceptanceCriterion,
    );
  }
  for (const acceptanceCriterionId of changed.acceptance_criteria.changed) {
    addAcceptanceCriterionScopeForChangedEntity(
      ensureFeaturePackage(requireFeatureIdForAcceptanceCriterion(state, acceptanceCriterionId)),
      acceptanceCriterionId,
      state,
      testsByAcceptanceCriterion,
    );
  }

  for (const testId of changed.tests.added) {
    addTestScopeForChangedEntity(
      ensureFeaturePackage(requireFeatureIdForTest(state, testId)),
      testId,
      state,
      testsByAcceptanceCriterion,
    );
  }

  for (const capabilityId of changed.capabilities.status_changed) {
    ensureCapabilityPackage(capabilityId);
  }
  for (const capabilityId of changed.capabilities.changed) {
    ensureCapabilityPackage(capabilityId);
  }
  for (const capabilityId of changed.capabilities.added) {
    const hasFeaturePackage = [...featurePackages.values()].some((draft) => draft.capability_ids.has(capabilityId));
    if (!hasFeaturePackage) {
      ensureCapabilityPackage(capabilityId);
    }
  }

  const drafts = [
    ...[...featurePackages.values()].sort((a, b) => a.sort_key.localeCompare(b.sort_key)),
    ...[...capabilityPackages.values()].sort((a, b) => a.sort_key.localeCompare(b.sort_key)),
  ];

  const workPackageIdByKey = new Map<string, string>();
  drafts.forEach((draft, index) => {
    workPackageIdByKey.set(draft.key, formatWorkPackageId(index + 1));
  });

  const workPackages = drafts.map((draft) => finalizeWorkPackage(draft, state, changed, workPackageIdByKey));

  return {
    base_branch: delta.base_branch,
    current_branch: delta.current_branch,
    product_id: delta.product_id,
    source_branch_delta: {
      branch_only_event_count: delta.branch_only_event_count,
      change_categories: delta.change_categories,
    },
    work_packages: workPackages,
  };
}

function finalizeWorkPackage(
  draft: DraftWorkPackage,
  state: ProductModelState,
  changed: ChangedEntitySets,
  workPackageIdByKey: Map<string, string>,
): WorkPackage {
  const workPackageId = workPackageIdByKey.get(draft.key);
  if (!workPackageId) {
    throw new Error(`Missing derived work-package id for '${draft.key}'`);
  }

  const capabilityIds = toSortedArray(draft.capability_ids);
  const featureIds = toSortedArray(draft.feature_ids);
  const requirementIds = toSortedArray(draft.requirement_ids);
  const acceptanceCriterionIds = toSortedArray(draft.acceptance_criterion_ids);
  const testIds = toSortedArray(draft.test_ids);
  const dependsOn = toSortedArray(draft.depends_on)
    .map((key) => workPackageIdByKey.get(key))
    .filter((value): value is string => Boolean(value))
    .sort();

  const changeSummary = CHANGE_SUMMARY_ORDER.filter((label) => hasChangeSummaryLabel(label, draft, changed));

  return {
    work_package_id: workPackageId,
    title: buildTitle(draft, state, changeSummary),
    change_summary: changeSummary,
    capability_ids: capabilityIds,
    feature_ids: featureIds,
    requirement_ids: requirementIds,
    acceptance_criterion_ids: acceptanceCriterionIds,
    test_ids: testIds,
    depends_on: dependsOn,
    rationale: buildRationale(draft, state),
  };
}

function hasChangeSummaryLabel(label: (typeof CHANGE_SUMMARY_ORDER)[number], draft: DraftWorkPackage, changed: ChangedEntitySets): boolean {
  switch (label) {
    case "add capability":
      return intersects(draft.capability_ids, changed.capabilities.added);
    case "capability status transition":
      return intersects(draft.capability_ids, changed.capabilities.status_changed);
    case "add feature":
      return intersects(draft.feature_ids, changed.features.added);
    case "change feature":
      return intersects(draft.feature_ids, changed.features.changed);
    case "move feature":
      return intersectsMap(draft.feature_ids, changed.features.moved);
    case "deprecate feature":
      return intersectsMap(draft.feature_ids, changed.features.deprecated);
    case "feature status transition":
      return intersectsMap(draft.feature_ids, changed.features.status_changed);
    case "add requirements":
      return intersects(draft.requirement_ids, changed.requirements.added);
    case "refine requirements":
      return intersects(draft.requirement_ids, changed.requirements.changed);
    case "add acceptance criteria":
      return intersects(draft.acceptance_criterion_ids, changed.acceptance_criteria.added);
    case "refine acceptance criteria":
      return intersects(draft.acceptance_criterion_ids, changed.acceptance_criteria.changed);
    case "add tests":
      return intersects(draft.test_ids, changed.tests.added);
    default:
      return false;
  }
}

function buildTitle(draft: DraftWorkPackage, state: ProductModelState, changeSummary: string[]): string {
  if (draft.kind === "feature") {
    const [featureId] = toSortedArray(draft.feature_ids);
    const feature = state.features.get(featureId);
    if (!feature) {
      throw new Error(`Missing feature '${featureId}' while building work-package title`);
    }

    const readinessOnly = changeSummary.length === 1 && changeSummary[0] === "feature status transition";
    if (changeSummary.includes("add feature")) {
      return `Implement ${feature.id} ${feature.name}`;
    }
    if (changeSummary.includes("move feature")) {
      return `Reshape ${feature.id} ${feature.name}`;
    }
    if (changeSummary.includes("deprecate feature")) {
      return `Deprecate ${feature.id} ${feature.name}`;
    }
    if (readinessOnly) {
      return `Advance ${feature.id} ${feature.name} readiness`;
    }
    return `Evolve ${feature.id} ${feature.name}`;
  }

  const [capabilityId] = toSortedArray(draft.capability_ids);
  const capability = state.capabilities.get(capabilityId);
  if (!capability) {
    throw new Error(`Missing capability '${capabilityId}' while building work-package title`);
  }

  const readinessOnly = changeSummary.length === 1 && changeSummary[0] === "capability status transition";
  if (changeSummary.includes("add capability")) {
    return `Define ${capability.id} ${capability.name}`;
  }
  if (readinessOnly) {
    return `Advance ${capability.id} ${capability.name} readiness`;
  }
  return `Evolve ${capability.id} ${capability.name}`;
}

function buildRationale(draft: DraftWorkPackage, state: ProductModelState): string {
  if (draft.kind === "feature") {
    const [featureId] = toSortedArray(draft.feature_ids);
    const feature = state.features.get(featureId);
    if (!feature) {
      throw new Error(`Missing feature '${featureId}' while building work-package rationale`);
    }

    return `All scoped changes roll up to ${feature.id}, so they are grouped into one coherent feature-level implementation slice under ${feature.capabilityId}.`;
  }

  const [capabilityId] = toSortedArray(draft.capability_ids);
  return `The changed scope is capability-level for ${capabilityId}, so it is kept as its own deterministic planning slice.`;
}

function toChangedEntitySets(delta: Awaited<ReturnType<typeof branchDelta>>): ChangedEntitySets {
  return {
    capabilities: {
      added: new Set(delta.changed_entities.capabilities.added.map((item) => item.capability_id)),
      changed: new Set(delta.changed_entities.capabilities.changed.map((item) => item.capability_id)),
      status_changed: new Set(delta.changed_entities.capabilities.status_changed.map((item) => item.capability_id)),
    },
    features: {
      added: new Set(delta.changed_entities.features.added.map((item) => item.feature_id)),
      changed: new Set(delta.changed_entities.features.changed.map((item) => item.feature_id)),
      moved: new Map(delta.changed_entities.features.moved.map((item) => [item.feature_id, {
        from_capability_id: item.from_capability_id,
        to_capability_id: item.to_capability_id,
      }])),
      deprecated: new Map(delta.changed_entities.features.deprecated.map((item) => [item.feature_id, item.reason])),
      status_changed: new Map(delta.changed_entities.features.status_changed.map((item) => [item.feature_id, item.status])),
    },
    requirements: {
      added: new Set(delta.changed_entities.requirements.added.map((item) => item.requirement_id)),
      changed: new Set(delta.changed_entities.requirements.changed.map((item) => item.requirement_id)),
    },
    acceptance_criteria: {
      added: new Set(delta.changed_entities.acceptance_criteria.added.map((item) => item.acceptance_criterion_id)),
      changed: new Set(delta.changed_entities.acceptance_criteria.changed.map((item) => item.acceptance_criterion_id)),
    },
    tests: {
      added: new Set(delta.changed_entities.tests.added.map((item) => item.test_id)),
    },
  };
}

function addFeatureScope(
  draft: DraftWorkPackage,
  featureId: string,
  state: ProductModelState,
  testsByAcceptanceCriterion: Map<string, string[]>,
): void {
  const feature = state.features.get(featureId);
  if (!feature) {
    throw new Error(`Missing feature '${featureId}' while deriving work-package scope`);
  }

  draft.feature_ids.add(feature.id);
  draft.capability_ids.add(feature.capabilityId);
  for (const requirementId of [...feature.requirementIds].sort()) {
    addRequirementScope(draft, requirementId, state, testsByAcceptanceCriterion);
  }
}

function addRequirementScopeForChangedEntity(
  draft: DraftWorkPackage,
  requirementId: string,
  state: ProductModelState,
  testsByAcceptanceCriterion: Map<string, string[]>,
): void {
  addRequirementScope(draft, requirementId, state, testsByAcceptanceCriterion);
}

function addRequirementScope(
  draft: DraftWorkPackage,
  requirementId: string,
  state: ProductModelState,
  testsByAcceptanceCriterion: Map<string, string[]>,
): void {
  const requirement = state.requirements.get(requirementId);
  if (!requirement) {
    throw new Error(`Missing requirement '${requirementId}' while deriving work-package scope`);
  }

  draft.requirement_ids.add(requirement.id);
  const feature = state.features.get(requirement.featureId);
  if (!feature) {
    throw new Error(`Missing feature '${requirement.featureId}' for requirement '${requirement.id}'`);
  }
  draft.feature_ids.add(feature.id);
  draft.capability_ids.add(feature.capabilityId);

  for (const acceptanceCriterionId of [...requirement.acceptanceCriterionIds].sort()) {
    addAcceptanceCriterionScope(draft, acceptanceCriterionId, state, testsByAcceptanceCriterion);
  }
}

function addAcceptanceCriterionScopeForChangedEntity(
  draft: DraftWorkPackage,
  acceptanceCriterionId: string,
  state: ProductModelState,
  testsByAcceptanceCriterion: Map<string, string[]>,
): void {
  addAcceptanceCriterionScope(draft, acceptanceCriterionId, state, testsByAcceptanceCriterion);
}

function addAcceptanceCriterionScope(
  draft: DraftWorkPackage,
  acceptanceCriterionId: string,
  state: ProductModelState,
  testsByAcceptanceCriterion: Map<string, string[]>,
): void {
  const acceptanceCriterion = state.acceptanceCriteria.get(acceptanceCriterionId);
  if (!acceptanceCriterion) {
    throw new Error(`Missing acceptance criterion '${acceptanceCriterionId}' while deriving work-package scope`);
  }

  draft.acceptance_criterion_ids.add(acceptanceCriterion.id);
  addRequirementScopeShallow(draft, acceptanceCriterion.requirementId, state);
  for (const testId of testsByAcceptanceCriterion.get(acceptanceCriterion.id) ?? []) {
    draft.test_ids.add(testId);
  }
}

function addTestScopeForChangedEntity(
  draft: DraftWorkPackage,
  testId: string,
  state: ProductModelState,
  testsByAcceptanceCriterion: Map<string, string[]>,
): void {
  const test = state.tests.get(testId);
  if (!test) {
    throw new Error(`Missing test '${testId}' while deriving work-package scope`);
  }

  draft.test_ids.add(test.id);
  addAcceptanceCriterionScope(draft, test.acceptanceCriterionId, state, testsByAcceptanceCriterion);
}

function addRequirementScopeShallow(draft: DraftWorkPackage, requirementId: string, state: ProductModelState): void {
  const requirement = state.requirements.get(requirementId);
  if (!requirement) {
    throw new Error(`Missing requirement '${requirementId}' while deriving work-package scope`);
  }

  draft.requirement_ids.add(requirement.id);
  const feature = state.features.get(requirement.featureId);
  if (!feature) {
    throw new Error(`Missing feature '${requirement.featureId}' for requirement '${requirement.id}'`);
  }
  draft.feature_ids.add(feature.id);
  draft.capability_ids.add(feature.capabilityId);
}

function requireFeatureId(state: ProductModelState, requirementId: string): string {
  const requirement = state.requirements.get(requirementId);
  if (!requirement) {
    throw new Error(`Missing requirement '${requirementId}' while deriving work packages`);
  }
  return requirement.featureId;
}

function requireFeatureIdForAcceptanceCriterion(state: ProductModelState, acceptanceCriterionId: string): string {
  const acceptanceCriterion = state.acceptanceCriteria.get(acceptanceCriterionId);
  if (!acceptanceCriterion) {
    throw new Error(`Missing acceptance criterion '${acceptanceCriterionId}' while deriving work packages`);
  }
  return requireFeatureId(state, acceptanceCriterion.requirementId);
}

function requireFeatureIdForTest(state: ProductModelState, testId: string): string {
  const test = state.tests.get(testId);
  if (!test) {
    throw new Error(`Missing test '${testId}' while deriving work packages`);
  }
  return requireFeatureIdForAcceptanceCriterion(state, test.acceptanceCriterionId);
}

function buildTestsByAcceptanceCriterion(state: ProductModelState): Map<string, string[]> {
  const map = new Map<string, string[]>();

  for (const test of [...state.tests.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    const existing = map.get(test.acceptanceCriterionId) ?? [];
    map.set(test.acceptanceCriterionId, [...existing, test.id]);
  }

  return map;
}

function formatWorkPackageId(value: number): string {
  return `WP-${String(value).padStart(3, "0")}`;
}

function toSortedArray(values: Set<string>): string[] {
  return [...values].sort();
}

function intersects(left: Set<string>, right: Set<string>): boolean {
  return [...left].some((value) => right.has(value));
}

function intersectsMap<T>(left: Set<string>, right: Map<string, T>): boolean {
  return [...left].some((value) => right.has(value));
}
