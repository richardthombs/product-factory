import { DEFAULT_CAPABILITY_STATUS, DEFAULT_FEATURE_STATUS } from "../domain/status.js";
import type { LoadedEvent } from "../validation/types.js";
import type {
  AcceptanceCriterionState,
  CapabilityState,
  FeatureState,
  ProductModelState,
  RequirementState,
  TestState,
} from "./types.js";

export function replayEvents(events: LoadedEvent[]): ProductModelState {
  let product: ProductModelState["product"] | null = null;
  const capabilities = new Map<string, CapabilityState>();
  const features = new Map<string, FeatureState>();
  const requirements = new Map<string, RequirementState>();
  const acceptanceCriteria = new Map<string, AcceptanceCriterionState>();
  const tests = new Map<string, TestState>();

  for (const { event, path } of events) {
    switch (event.type) {
      case "ProductCreated": {
        product = {
          id: event.payload.product_id,
          name: event.payload.name,
          description: event.payload.description,
        };
        break;
      }
      case "CapabilityAdded": {
        capabilities.set(event.payload.capability_id, {
          id: event.payload.capability_id,
          name: event.payload.name,
          description: event.payload.description,
          status: DEFAULT_CAPABILITY_STATUS,
          featureIds: [],
        });
        break;
      }
      case "FeatureAdded": {
        const capability = capabilities.get(event.payload.capability_id);
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

        features.set(nextFeature.id, nextFeature);
        capability.featureIds = [...capability.featureIds, nextFeature.id].sort();
        break;
      }
      case "RequirementAdded": {
        const feature = features.get(event.payload.feature_id);
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

        requirements.set(nextRequirement.id, nextRequirement);
        feature.requirementIds = [...feature.requirementIds, nextRequirement.id].sort();
        break;
      }
      case "AcceptanceCriterionAdded": {
        const requirement = requirements.get(event.payload.requirement_id);
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

        acceptanceCriteria.set(nextAcceptanceCriterion.id, nextAcceptanceCriterion);
        requirement.acceptanceCriterionIds = [...requirement.acceptanceCriterionIds, nextAcceptanceCriterion.id].sort();
        break;
      }
      case "FeatureChanged": {
        const feature = features.get(event.payload.feature_id);
        if (!feature) {
          throw new Error(
            `Cannot replay FeatureChanged from ${path}: missing feature '${event.payload.feature_id}'`,
          );
        }

        feature.description = event.payload.description;
        break;
      }
      case "RequirementChanged": {
        const requirement = requirements.get(event.payload.requirement_id);
        if (!requirement) {
          throw new Error(
            `Cannot replay RequirementChanged from ${path}: missing requirement '${event.payload.requirement_id}'`,
          );
        }

        requirement.description = event.payload.description;
        break;
      }
      case "AcceptanceCriterionChanged": {
        const acceptanceCriterion = acceptanceCriteria.get(event.payload.acceptance_criterion_id);
        if (!acceptanceCriterion) {
          throw new Error(
            `Cannot replay AcceptanceCriterionChanged from ${path}: missing acceptance criterion '${event.payload.acceptance_criterion_id}'`,
          );
        }

        acceptanceCriterion.text = event.payload.text;
        break;
      }
      case "FeatureMovedToCapability": {
        const feature = features.get(event.payload.feature_id);
        if (!feature) {
          throw new Error(
            `Cannot replay FeatureMovedToCapability from ${path}: missing feature '${event.payload.feature_id}'`,
          );
        }

        const targetCapability = capabilities.get(event.payload.capability_id);
        if (!targetCapability) {
          throw new Error(
            `Cannot replay FeatureMovedToCapability from ${path}: missing capability '${event.payload.capability_id}'`,
          );
        }

        const currentCapability = capabilities.get(feature.capabilityId);
        if (!currentCapability) {
          throw new Error(
            `Cannot replay FeatureMovedToCapability from ${path}: missing current capability '${feature.capabilityId}'`,
          );
        }

        currentCapability.featureIds = currentCapability.featureIds.filter((featureId) => featureId !== feature.id);
        targetCapability.featureIds = [...targetCapability.featureIds, feature.id].sort();
        feature.capabilityId = targetCapability.id;
        break;
      }
      case "FeatureDeprecated": {
        const feature = features.get(event.payload.feature_id);
        if (!feature) {
          throw new Error(
            `Cannot replay FeatureDeprecated from ${path}: missing feature '${event.payload.feature_id}'`,
          );
        }

        feature.status = "deprecated";
        feature.deprecatedReason = event.payload.reason;
        feature.statusReason = event.payload.reason;
        break;
      }
      case "FeatureStatusChanged": {
        const feature = features.get(event.payload.feature_id);
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
        break;
      }
      case "CapabilityStatusChanged": {
        const capability = capabilities.get(event.payload.capability_id);
        if (!capability) {
          throw new Error(
            `Cannot replay CapabilityStatusChanged from ${path}: missing capability '${event.payload.capability_id}'`,
          );
        }

        capability.status = event.payload.status;
        capability.statusReason = event.payload.reason;
        break;
      }
      case "TestCreated": {
        const acceptanceCriterion = acceptanceCriteria.get(event.payload.acceptance_criterion_id);
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

        tests.set(nextTest.id, nextTest);
        break;
      }
      default: {
        assertNever(event);
      }
    }
  }

  if (!product) {
    throw new Error("Cannot replay events: product was never created");
  }

  return {
    product,
    capabilities,
    features,
    requirements,
    acceptanceCriteria,
    tests,
  };
}

function assertNever(value: never): never {
  throw new Error(`Unexpected event type during replay: ${JSON.stringify(value)}`);
}
