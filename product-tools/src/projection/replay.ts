import { DEFAULT_CAPABILITY_STATUS, DEFAULT_FEATURE_STATUS } from "../domain/status.js";
import type { EntityType } from "../schemas/events.js";
import type { LoadedEvent } from "../validation/types.js";
import type {
  AcceptanceCriterionState,
  CapabilityState,
  EntityRevisionMap,
  EntityRevisionState,
  FeatureState,
  ProductModelState,
  ProductState,
  RequirementState,
  TestState,
} from "./types.js";

type ReplayAccumulator = Omit<ProductModelState, "product"> & {
  product: ProductState | null;
};

export function replayEvents(events: LoadedEvent[]): ProductModelState {
  const state: ReplayAccumulator = {
    product: null,
    capabilities: new Map<string, CapabilityState>(),
    features: new Map<string, FeatureState>(),
    requirements: new Map<string, RequirementState>(),
    acceptanceCriteria: new Map<string, AcceptanceCriterionState>(),
    tests: new Map<string, TestState>(),
    entityRevisions: createEntityRevisionMap(),
  };

  for (const loaded of events) {
    applyLoadedEvent(state, loaded);
  }

  if (!state.product) {
    throw new Error("Cannot replay events: product was never created");
  }

  return {
    product: state.product,
    capabilities: state.capabilities,
    features: state.features,
    requirements: state.requirements,
    acceptanceCriteria: state.acceptanceCriteria,
    tests: state.tests,
    entityRevisions: state.entityRevisions,
  };
}

export function getEntityRevision(
  state: ProductModelState,
  entityType: EntityType,
  entityId: string,
): EntityRevisionState | undefined {
  return state.entityRevisions[entityType].get(entityId);
}

export function requireEntityRevision(
  state: ProductModelState,
  entityType: EntityType,
  entityId: string,
): EntityRevisionState {
  const revision = getEntityRevision(state, entityType, entityId);
  if (!revision) {
    throw new Error(`Missing ${entityType} revision for '${entityId}'`);
  }
  return revision;
}

function applyLoadedEvent(state: ReplayAccumulator, { event, path }: LoadedEvent): void {
  switch (event.type) {
    case "ProductCreated": {
      state.product = {
        id: event.payload.product_id,
        name: event.payload.name,
        description: event.payload.description,
      };
      touchEntity(state.entityRevisions, "product", event.payload.product_id, event.id);
      break;
    }
    case "CapabilityAdded": {
      state.capabilities.set(event.payload.capability_id, {
        id: event.payload.capability_id,
        name: event.payload.name,
        description: event.payload.description,
        status: DEFAULT_CAPABILITY_STATUS,
        featureIds: [],
      });
      touchEntity(state.entityRevisions, "capability", event.payload.capability_id, event.id);
      break;
    }
    case "FeatureAdded": {
      const capability = state.capabilities.get(event.payload.capability_id);
      if (!capability) {
        throw new Error(
          `Cannot replay FeatureAdded from ${path}: missing capability '${event.payload.capability_id}'`,
        );
      }

      const nextFeature: FeatureState = {
        id: event.payload.feature_id,
        capabilityId: event.payload.capability_id,
        name: event.payload.name,
        description: event.payload.description,
        status: DEFAULT_FEATURE_STATUS,
        requirementIds: [],
      };

      state.features.set(nextFeature.id, nextFeature);
      capability.featureIds = [...capability.featureIds, nextFeature.id].sort();
      touchEntity(state.entityRevisions, "feature", nextFeature.id, event.id);
      touchEntity(state.entityRevisions, "capability", capability.id, event.id);
      break;
    }
    case "RequirementAdded": {
      const feature = state.features.get(event.payload.feature_id);
      if (!feature) {
        throw new Error(
          `Cannot replay RequirementAdded from ${path}: missing feature '${event.payload.feature_id}'`,
        );
      }

      const nextRequirement: RequirementState = {
        id: event.payload.requirement_id,
        featureId: event.payload.feature_id,
        description: event.payload.description,
        acceptanceCriterionIds: [],
      };

      state.requirements.set(nextRequirement.id, nextRequirement);
      feature.requirementIds = [...feature.requirementIds, nextRequirement.id].sort();
      touchEntity(state.entityRevisions, "requirement", nextRequirement.id, event.id);
      touchEntity(state.entityRevisions, "feature", feature.id, event.id);
      break;
    }
    case "AcceptanceCriterionAdded": {
      const requirement = state.requirements.get(event.payload.requirement_id);
      if (!requirement) {
        throw new Error(
          `Cannot replay AcceptanceCriterionAdded from ${path}: missing requirement '${event.payload.requirement_id}'`,
        );
      }

      const nextAcceptanceCriterion: AcceptanceCriterionState = {
        id: event.payload.acceptance_criterion_id,
        requirementId: event.payload.requirement_id,
        text: event.payload.text,
      };

      state.acceptanceCriteria.set(nextAcceptanceCriterion.id, nextAcceptanceCriterion);
      requirement.acceptanceCriterionIds = [...requirement.acceptanceCriterionIds, nextAcceptanceCriterion.id].sort();
      touchEntity(state.entityRevisions, "acceptance_criterion", nextAcceptanceCriterion.id, event.id);
      touchEntity(state.entityRevisions, "requirement", requirement.id, event.id);
      break;
    }
    case "FeatureChanged": {
      const feature = state.features.get(event.payload.feature_id);
      if (!feature) {
        throw new Error(
          `Cannot replay FeatureChanged from ${path}: missing feature '${event.payload.feature_id}'`,
        );
      }

      feature.description = event.payload.description;
      touchEntity(state.entityRevisions, "feature", feature.id, event.id);
      break;
    }
    case "RequirementChanged": {
      const requirement = state.requirements.get(event.payload.requirement_id);
      if (!requirement) {
        throw new Error(
          `Cannot replay RequirementChanged from ${path}: missing requirement '${event.payload.requirement_id}'`,
        );
      }

      requirement.description = event.payload.description;
      touchEntity(state.entityRevisions, "requirement", requirement.id, event.id);
      break;
    }
    case "AcceptanceCriterionChanged": {
      const acceptanceCriterion = state.acceptanceCriteria.get(event.payload.acceptance_criterion_id);
      if (!acceptanceCriterion) {
        throw new Error(
          `Cannot replay AcceptanceCriterionChanged from ${path}: missing acceptance criterion '${event.payload.acceptance_criterion_id}'`,
        );
      }

      acceptanceCriterion.text = event.payload.text;
      touchEntity(state.entityRevisions, "acceptance_criterion", acceptanceCriterion.id, event.id);
      break;
    }
    case "FeatureMovedToCapability": {
      const feature = state.features.get(event.payload.feature_id);
      if (!feature) {
        throw new Error(
          `Cannot replay FeatureMovedToCapability from ${path}: missing feature '${event.payload.feature_id}'`,
        );
      }

      const targetCapability = state.capabilities.get(event.payload.capability_id);
      if (!targetCapability) {
        throw new Error(
          `Cannot replay FeatureMovedToCapability from ${path}: missing capability '${event.payload.capability_id}'`,
        );
      }

      const currentCapability = state.capabilities.get(feature.capabilityId);
      if (!currentCapability) {
        throw new Error(
          `Cannot replay FeatureMovedToCapability from ${path}: missing current capability '${feature.capabilityId}'`,
        );
      }

      currentCapability.featureIds = currentCapability.featureIds.filter((featureId) => featureId !== feature.id);
      targetCapability.featureIds = [...targetCapability.featureIds, feature.id].sort();
      feature.capabilityId = targetCapability.id;
      touchEntity(state.entityRevisions, "feature", feature.id, event.id);
      touchEntity(state.entityRevisions, "capability", currentCapability.id, event.id);
      touchEntity(state.entityRevisions, "capability", targetCapability.id, event.id);
      break;
    }
    case "FeatureDeprecated": {
      const feature = state.features.get(event.payload.feature_id);
      if (!feature) {
        throw new Error(
          `Cannot replay FeatureDeprecated from ${path}: missing feature '${event.payload.feature_id}'`,
        );
      }

      feature.status = "deprecated";
      feature.deprecatedReason = event.payload.reason;
      feature.statusReason = event.payload.reason;
      touchEntity(state.entityRevisions, "feature", feature.id, event.id);
      break;
    }
    case "FeatureStatusChanged": {
      const feature = state.features.get(event.payload.feature_id);
      if (!feature) {
        throw new Error(
          `Cannot replay FeatureStatusChanged from ${path}: missing feature '${event.payload.feature_id}'`,
        );
      }

      feature.status = event.payload.status;
      feature.statusReason = event.payload.reason;
      if (event.payload.status !== "deprecated") {
        delete feature.deprecatedReason;
      }
      touchEntity(state.entityRevisions, "feature", feature.id, event.id);
      break;
    }
    case "CapabilityStatusChanged": {
      const capability = state.capabilities.get(event.payload.capability_id);
      if (!capability) {
        throw new Error(
          `Cannot replay CapabilityStatusChanged from ${path}: missing capability '${event.payload.capability_id}'`,
        );
      }

      capability.status = event.payload.status;
      capability.statusReason = event.payload.reason;
      touchEntity(state.entityRevisions, "capability", capability.id, event.id);
      break;
    }
    case "TestCreated": {
      const acceptanceCriterion = state.acceptanceCriteria.get(event.payload.acceptance_criterion_id);
      if (!acceptanceCriterion) {
        throw new Error(
          `Cannot replay TestCreated from ${path}: missing acceptance criterion '${event.payload.acceptance_criterion_id}'`,
        );
      }

      const nextTest: TestState = {
        id: event.payload.test_id,
        acceptanceCriterionId: acceptanceCriterion.id,
        filePath: event.payload.file_path,
        testName: event.payload.test_name,
      };

      state.tests.set(nextTest.id, nextTest);
      touchEntity(state.entityRevisions, "test", nextTest.id, event.id);
      touchEntity(state.entityRevisions, "acceptance_criterion", acceptanceCriterion.id, event.id);
      break;
    }
    default: {
      assertNever(event);
    }
  }
}

function createEntityRevisionMap(): EntityRevisionMap {
  return {
    product: new Map<string, EntityRevisionState>(),
    capability: new Map<string, EntityRevisionState>(),
    feature: new Map<string, EntityRevisionState>(),
    requirement: new Map<string, EntityRevisionState>(),
    acceptance_criterion: new Map<string, EntityRevisionState>(),
    test: new Map<string, EntityRevisionState>(),
  };
}

function touchEntity(
  revisions: EntityRevisionMap,
  entityType: EntityType,
  entityId: string,
  eventId: string,
): void {
  const current = revisions[entityType].get(entityId);
  revisions[entityType].set(entityId, {
    entityType,
    entityId,
    revision: (current?.revision ?? 0) + 1,
    lastEventId: eventId,
  });
}

function assertNever(value: never): never {
  throw new Error(`Unexpected event type during replay: ${JSON.stringify(value)}`);
}
