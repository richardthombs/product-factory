import type { CapabilityStatus, FeatureStatus } from "../domain/status.js";

export type ProductState = {
  id: string;
  name: string;
  description: string;
};

export type CapabilityState = {
  id: string;
  name: string;
  description: string;
  status: CapabilityStatus;
  statusReason?: string;
  featureIds: string[];
};

export type FeatureState = {
  id: string;
  capabilityId: string;
  name: string;
  description: string;
  status: FeatureStatus;
  statusReason?: string;
  deprecatedReason?: string;
  requirementIds: string[];
};

export type RequirementState = {
  id: string;
  featureId: string;
  description: string;
  acceptanceCriterionIds: string[];
};

export type AcceptanceCriterionState = {
  id: string;
  requirementId: string;
  text: string;
};

export type TestState = {
  id: string;
  acceptanceCriterionId: string;
  filePath: string;
  testName: string;
};

export type ProductModelState = {
  product: ProductState;
  capabilities: Map<string, CapabilityState>;
  features: Map<string, FeatureState>;
  requirements: Map<string, RequirementState>;
  acceptanceCriteria: Map<string, AcceptanceCriterionState>;
  tests: Map<string, TestState>;
};

export type ProjectionSummary = {
  eventCount: number;
  capabilityCount: number;
  featureCount: number;
  requirementCount: number;
  acceptanceCriterionCount: number;
  testCount: number;
  lastEventId: string;
  lastOccurredAt: string;
};
